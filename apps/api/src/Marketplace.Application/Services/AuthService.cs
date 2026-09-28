using System.Security.Cryptography;
using System.Text;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Marketplace.Application.Services;

public sealed class AuthOptions
{
    public int RefreshTokenDays { get; set; } = 30;
    public int PasswordResetMinutes { get; set; } = 60;
    public int MinPasswordLength { get; set; } = 8;
}

public sealed class AuthService(
    IAppDbContext db,
    IJwtTokenService jwt,
    IPasswordService passwords,
    IGoogleTokenVerifier google,
    IEmailSender email,
    ILinkBuilder links,
    PlatformSettingsProvider settingsProvider,
    ICurrentUser currentUser,
    IOptions<AuthOptions> options,
    TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;
    private AuthOptions Options => options.Value;

    public async Task<AuthResponseDto> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var emailNorm = NormalizeEmail(request.Email);
        new ValidationErrors()
            .AddIf(!Documents.IsValidEmail(emailNorm), "email", "E-mail inválido.")
            .AddIf(string.IsNullOrEmpty(request.Password), "password", "Informe sua senha.")
            .ThrowIfAny();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == emailNorm && u.AnonymizedAt == null, ct);
        // Mensagem única para não revelar se o e-mail existe.
        if (user?.PasswordHash is null || !passwords.Verify(user.PasswordHash, request.Password!))
            throw AppException.Validation("password", "E-mail ou senha incorretos.");
        EnsureNotBlocked(user);

        await AuditAsync(user.Id, "auth.login", ct);
        return await IssueSessionAsync(user, ct);
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var emailNorm = NormalizeEmail(request.Email);
        var fullName = request.FullName?.Trim() ?? string.Empty;
        var phone = Documents.OnlyDigits(request.Phone);
        var errors = new ValidationErrors()
            .AddIf(fullName.Length < 3, "fullName", "Informe seu nome completo.")
            .AddIf(!Documents.IsValidEmail(emailNorm), "email", "E-mail inválido.")
            .AddIf(phone.Length is not (0 or 10 or 11), "phone", "Celular inválido.")
            .AddIf((request.Password?.Length ?? 0) < Options.MinPasswordLength, "password", $"A senha deve ter pelo menos {Options.MinPasswordLength} caracteres.")
            .AddIf(request.AcceptTerms == false, "acceptTerms", "É preciso aceitar os termos de uso e a política de privacidade.");
        errors.ThrowIfAny();
        if (await db.Users.AnyAsync(u => u.Email == emailNorm, ct))
            throw AppException.Validation("email", "Este e-mail já está cadastrado.");

        var now = Now;
        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = fullName,
            Email = emailNorm,
            PasswordHash = passwords.Hash(request.Password!),
            Phone = phone.Length == 0 ? null : phone,
            Roles = [UserRole.Comprador],
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Users.Add(user);
        await RecordConsentsAsync(user.Id, ct);
        await AuditAsync(user.Id, "auth.register", ct);
        return await IssueSessionAsync(user, ct);
    }

    public async Task<AuthResponseDto> GoogleAsync(GoogleAuthRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken)) throw AppException.Validation("idToken", "Token inválido.");
        if (!google.IsConfigured)
            throw AppException.Validation("idToken", "Login com Google não está configurado neste ambiente.");
        var identity = await google.VerifyAsync(request.IdToken, ct)
                       ?? throw AppException.Validation("idToken", "Não foi possível validar o login com o Google.");
        var emailNorm = NormalizeEmail(identity.Email);

        var user = await db.Users.FirstOrDefaultAsync(u => u.GoogleSubject == identity.Subject, ct)
                   ?? await db.Users.FirstOrDefaultAsync(u => u.Email == emailNorm, ct);
        var now = Now;
        if (user is null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                FullName = identity.Name ?? emailNorm.Split('@')[0],
                Email = emailNorm,
                GoogleSubject = identity.Subject,
                AvatarUrl = identity.Picture,
                EmailVerified = identity.EmailVerified,
                Roles = [UserRole.Comprador],
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.Users.Add(user);
            await RecordConsentsAsync(user.Id, ct);
        }
        else
        {
            if (user.AnonymizedAt is not null) throw AppException.Validation("idToken", "Esta conta foi encerrada.");
            EnsureNotBlocked(user);
            user.GoogleSubject ??= identity.Subject;
            user.AvatarUrl ??= identity.Picture;
            user.EmailVerified |= identity.EmailVerified;
            user.UpdatedAt = now;
        }
        await AuditAsync(user.Id, "auth.google", ct);
        return await IssueSessionAsync(user, ct);
    }

    /// <summary>Sempre 202: não revela se o e-mail existe.</summary>
    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct)
    {
        var emailNorm = NormalizeEmail(request.Email);
        if (!Documents.IsValidEmail(emailNorm)) throw AppException.Validation("email", "E-mail inválido.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == emailNorm && u.AnonymizedAt == null, ct);
        if (user is null) return;

        var token = RandomToken();
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = Sha256(token),
            ExpiresAt = Now.AddMinutes(Options.PasswordResetMinutes),
        });
        await db.SaveChangesAsync(ct);
        var link = links.PasswordReset(token);
        await email.SendAsync(new EmailMessage(
            user.Email,
            "Redefinição de senha — Marketplace PY",
            $"Olá, {user.FullName}!\n\nPara redefinir sua senha, acesse: {link}\n\nO link vale por {Options.PasswordResetMinutes} minutos. Se você não pediu isso, ignore este e-mail."), ct);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct)
    {
        new ValidationErrors()
            .AddIf(string.IsNullOrWhiteSpace(request.Token), "token", "Token inválido.")
            .AddIf((request.Password?.Length ?? 0) < Options.MinPasswordLength, "password", $"A senha deve ter pelo menos {Options.MinPasswordLength} caracteres.")
            .ThrowIfAny();
        var hash = Sha256(request.Token!);
        var now = Now;
        var reset = await db.PasswordResetTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.UsedAt == null && t.ExpiresAt > now, ct)
                    ?? throw AppException.Validation("token", "Link inválido ou expirado. Solicite um novo.");
        var user = await db.Users.FirstAsync(u => u.Id == reset.UserId, ct);
        user.PasswordHash = passwords.Hash(request.Password!);
        user.UpdatedAt = now;
        reset.UsedAt = now;
        await RevokeAllAsync(user.Id, ct);
        await AuditAsync(user.Id, "auth.password_reset", ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task<AuthResponseDto> RefreshAsync(string? refreshToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(refreshToken)) throw AppException.Unauthorized("Refresh token ausente.");
        var hash = Sha256(refreshToken);
        var now = Now;
        var token = await db.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is null || !token.IsActive(now) || !token.User.IsActive)
        {
            // Reuso de token rotacionado: possível roubo → revoga a família inteira.
            if (token is { RevokedAt: not null }) await RevokeAllAsync(token.UserId, ct);
            await db.SaveChangesAsync(ct);
            throw AppException.Unauthorized();
        }
        token.RevokedAt = now;
        var session = await IssueSessionAsync(token.User, ct, replacing: token);
        return session;
    }

    public async Task LogoutAsync(string? refreshToken, CancellationToken ct)
    {
        var now = Now;
        if (!string.IsNullOrWhiteSpace(refreshToken))
        {
            var hash = Sha256(refreshToken);
            var token = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
            if (token is not null) token.RevokedAt ??= now;
        }
        else if (currentUser.UserId is { } userId)
        {
            await RevokeAllAsync(userId, ct);
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Reemite a sessão (ex.: após ganhar o papel Vendedor, para o JWT refletir as novas permissões).</summary>
    public Task<AuthResponseDto> ReissueSessionAsync(User user, CancellationToken ct) => IssueSessionAsync(user, ct);

    private async Task<AuthResponseDto> IssueSessionAsync(User user, CancellationToken ct, RefreshToken? replacing = null)
    {
        var now = Now;
        var plain = RandomToken();
        var refresh = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = Sha256(plain),
            CreatedAt = now,
            ExpiresAt = now.AddDays(Options.RefreshTokenDays),
            UserAgent = Truncate(currentUser.UserAgent, 256),
            IpAddress = Truncate(currentUser.IpAddress, 64),
        };
        if (replacing is not null) replacing.ReplacedByHash = refresh.TokenHash;
        db.RefreshTokens.Add(refresh);
        await db.SaveChangesAsync(ct);
        var access = jwt.IssueAccessToken(user);
        return new AuthResponseDto(access.Token, plain, access.ExpiresAt, user.ToDto());
    }

    private async Task RevokeAllAsync(Guid userId, CancellationToken ct)
    {
        var now = Now;
        var active = await db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null).ToListAsync(ct);
        foreach (var t in active) t.RevokedAt = now;
    }

    private async Task RecordConsentsAsync(Guid userId, CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        var now = Now;
        db.Consents.Add(new Consent { Id = Guid.NewGuid(), UserId = userId, Type = ConsentType.TermosDeUso, Version = settings.TermsVersion, AcceptedAt = now, IpAddress = Truncate(currentUser.IpAddress, 64), UserAgent = Truncate(currentUser.UserAgent, 256) });
        db.Consents.Add(new Consent { Id = Guid.NewGuid(), UserId = userId, Type = ConsentType.PoliticaDePrivacidade, Version = settings.PrivacyPolicyVersion, AcceptedAt = now, IpAddress = Truncate(currentUser.IpAddress, 64), UserAgent = Truncate(currentUser.UserAgent, 256) });
    }

    private Task AuditAsync(Guid userId, string action, CancellationToken ct)
    {
        db.AuditLogs.Add(new AuditLog { UserId = userId, Action = action, OccurredAt = Now, IpAddress = Truncate(currentUser.IpAddress, 64) });
        return Task.CompletedTask;
    }

    public static void EnsureNotBlocked(User user)
    {
        if (user.BlockedAt is not null)
            throw new AppException(403, "ACCOUNT_BLOCKED", "Esta conta está bloqueada. Fale com o suporte.");
    }

    public static string NormalizeEmail(string? email) => (email ?? string.Empty).Trim().ToLowerInvariant();

    public static string Sha256(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static string RandomToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string? Truncate(string? value, int max) => value is null ? null : value.Length <= max ? value : value[..max];
}
