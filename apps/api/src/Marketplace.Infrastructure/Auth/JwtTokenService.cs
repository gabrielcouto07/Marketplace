using System.Security.Claims;
using System.Text;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Entities;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Auth;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "marketplace-py";
    public string Audience { get; set; } = "marketplace-py-web";
    /// <summary>Mínimo 32 caracteres. Em produção, use user-secrets/variável de ambiente.</summary>
    public string Secret { get; set; } = string.Empty;
    /// <summary>O front ainda não renova o token automaticamente; manter longo até o interceptor 401→refresh existir.</summary>
    public int AccessTokenMinutes { get; set; } = 7 * 24 * 60;

    public SymmetricSecurityKey SigningKey => new(Encoding.UTF8.GetBytes(Secret));
}

public sealed class JwtTokenService(IOptions<JwtOptions> options, TimeProvider clock) : IJwtTokenService
{
    private readonly JsonWebTokenHandler _handler = new();

    public IssuedAccessToken IssueAccessToken(User user)
    {
        var o = options.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        var expires = now.AddMinutes(o.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Name, user.FullName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };
        claims.AddRange(user.Roles.Select(r => new Claim(ClaimTypes.Role, r.ToString())));
        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = o.Issuer,
            Audience = o.Audience,
            Subject = new ClaimsIdentity(claims),
            NotBefore = now,
            IssuedAt = now,
            Expires = expires,
            SigningCredentials = new SigningCredentials(o.SigningKey, SecurityAlgorithms.HmacSha256),
        });
        return new IssuedAccessToken(token, expires);
    }
}

public sealed class PasswordService : IPasswordService
{
    private readonly Microsoft.AspNetCore.Identity.PasswordHasher<object> _hasher = new();
    private static readonly object Marker = new();

    public string Hash(string password) => _hasher.HashPassword(Marker, password);

    public bool Verify(string hash, string password) =>
        _hasher.VerifyHashedPassword(Marker, hash, password) is not Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed;
}

public sealed class GoogleOptions
{
    public string? ClientId { get; set; }
}

public sealed class GoogleTokenVerifier(IOptions<GoogleOptions> options) : IGoogleTokenVerifier
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.Value.ClientId);

    public async Task<GoogleIdentity?> VerifyAsync(string idToken, CancellationToken ct)
    {
        if (!IsConfigured) return null;
        try
        {
            var payload = await Google.Apis.Auth.GoogleJsonWebSignature.ValidateAsync(idToken,
                new Google.Apis.Auth.GoogleJsonWebSignature.ValidationSettings { Audience = [options.Value.ClientId!] });
            return new GoogleIdentity(payload.Subject, payload.Email, payload.Name, payload.Picture, payload.EmailVerified);
        }
        catch (Google.Apis.Auth.InvalidJwtException)
        {
            return null;
        }
    }
}
