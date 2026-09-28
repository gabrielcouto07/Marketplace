using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Marketplace.Application.Services;

public sealed class PrivacyOptions
{
    /// <summary>E-mail do encarregado (DPO) — LGPD art. 41.</summary>
    public string DataControllerEmail { get; set; } = "privacidade@marketplacepy.com";
    public string AccountDeletionConfirmation { get; set; } = "EXCLUIR MINHA CONTA";
}

/// <summary>Direitos do titular (LGPD art. 18): acesso/portabilidade, consentimento e eliminação.</summary>
public sealed class PrivacyService(
    IAppDbContext db,
    AccountService account,
    OrderService orders,
    IPasswordService passwords,
    ILinkBuilder links,
    PlatformSettingsProvider settingsProvider,
    ICurrentUser currentUser,
    IOptions<PrivacyOptions> options,
    TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public async Task<PrivacyPolicyDto> PolicyAsync(CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        return new PrivacyPolicyDto(
            settings.TermsVersion, settings.PrivacyPolicyVersion, links.Terms(), links.PrivacyPolicy(),
            options.Value.DataControllerEmail,
            [
                "Processar compras, pagamentos e entregas internacionais (execução de contrato).",
                "Cumprir obrigações fiscais e aduaneiras (Remessa Conforme).",
                "Prevenir fraudes e proteger contas (legítimo interesse).",
                "Enviar comunicações de marketing apenas com consentimento.",
            ]);
    }

    public async Task<IReadOnlyList<ConsentDto>> ConsentsAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var list = await db.Consents.AsNoTracking().Where(c => c.UserId == userId).OrderByDescending(c => c.AcceptedAt).ToListAsync(ct);
        return list.Select(c => c.ToDto()).ToList();
    }

    public async Task<IReadOnlyList<ConsentDto>> UpdateConsentAsync(ConsentInput input, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        if (input.Type != ConsentType.Marketing && !input.Granted)
            throw AppException.Conflict("CONSENT_REQUIRED", "Termos e política de privacidade são necessários para usar a conta. Para encerrar, use a exclusão de conta.");
        var settings = await settingsProvider.GetAsync(ct);
        var version = input.Type switch
        {
            ConsentType.TermosDeUso => settings.TermsVersion,
            ConsentType.PoliticaDePrivacidade => settings.PrivacyPolicyVersion,
            _ => "1",
        };
        var now = Now;
        var active = await db.Consents.Where(c => c.UserId == userId && c.Type == input.Type && c.RevokedAt == null).ToListAsync(ct);
        if (input.Granted)
        {
            if (!active.Any(c => c.Version == version))
                db.Consents.Add(new Consent { Id = Guid.NewGuid(), UserId = userId, Type = input.Type, Version = version, AcceptedAt = now, IpAddress = currentUser.IpAddress, UserAgent = currentUser.UserAgent });
        }
        else foreach (var c in active) c.RevokedAt = now;
        db.AuditLogs.Add(new AuditLog { UserId = userId, Action = input.Granted ? "consent.grant" : "consent.revoke", Target = input.Type.ToString(), OccurredAt = now, IpAddress = currentUser.IpAddress });
        await db.SaveChangesAsync(ct);
        return await ConsentsAsync(ct);
    }

    /// <summary>Portabilidade: todos os dados pessoais em JSON.</summary>
    public async Task<PersonalDataExportDto> ExportAsync(CancellationToken ct)
    {
        var user = await account.RequireUserAsync(ct);
        var addresses = await account.AddressesAsync(ct);
        var orderList = await orders.FullOrders().AsNoTracking().Where(o => o.UserId == user.Id).OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        var consents = await ConsentsAsync(ct);
        var questions = await db.Questions.AsNoTracking().Where(q => q.UserId == user.Id).ToListAsync(ct);
        var reviews = await db.Reviews.AsNoTracking().Where(r => r.UserId == user.Id).ToListAsync(ct);
        db.AuditLogs.Add(new AuditLog { UserId = user.Id, Action = "privacy.export", OccurredAt = Now, IpAddress = currentUser.IpAddress });
        await db.SaveChangesAsync(ct);
        return new PersonalDataExportDto(
            Now, user.ToDto(), addresses,
            orderList.Select(o => o.ToDto(currentUser.Locale)).ToList(),
            consents, questions.Select(q => q.ToDto()).ToList(), reviews.Select(r => r.ToDto()).ToList());
    }

    /// <summary>
    /// Eliminação: anonimiza dados pessoais e revoga sessões. Pedidos e pagamentos são mantidos pelo prazo legal
    /// (obrigações fiscais), mas sem vínculo identificável.
    /// </summary>
    public async Task DeleteAccountAsync(DeleteAccountRequest request, CancellationToken ct)
    {
        var user = await account.RequireUserAsync(ct);
        if (user.PasswordHash is not null)
        {
            if (string.IsNullOrEmpty(request.Password) || !passwords.Verify(user.PasswordHash, request.Password))
                throw AppException.Validation("password", "Senha incorreta.");
        }
        else if (!string.Equals(request.Confirmation?.Trim(), options.Value.AccountDeletionConfirmation, StringComparison.Ordinal))
        {
            throw AppException.Validation("confirmation", $"Digite \"{options.Value.AccountDeletionConfirmation}\" para confirmar.");
        }

        await AnonymizeAsync(user, requireNoOpenOrders: true, ct);
        db.AuditLogs.Add(new AuditLog { UserId = user.Id, Action = "privacy.delete_account", OccurredAt = Now, IpAddress = currentUser.IpAddress });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Anonimização propriamente dita (usada pelo titular e pelo admin). Não salva.</summary>
    public async Task AnonymizeAsync(User user, bool requireNoOpenOrders, CancellationToken ct)
    {
        if (requireNoOpenOrders)
        {
            var openOrders = await db.Orders.CountAsync(o => o.UserId == user.Id && o.Status != OrderStatus.Concluido && o.Status != OrderStatus.Cancelado && o.Status != OrderStatus.Reembolsado, ct);
            if (openOrders > 0)
                throw AppException.Conflict("ACCOUNT_HAS_OPEN_ORDERS", "Há pedidos em andamento. Aguarde a conclusão para encerrar a conta.");
        }

        var now = Now;
        var tombstone = $"removido+{user.Id:N}@anonimizado.local";
        user.FullName = "Usuário removido";
        user.Email = tombstone;
        user.PasswordHash = null;
        user.Phone = null;
        user.Cpf = null;
        user.AvatarUrl = null;
        user.GoogleSubject = null;
        user.AnonymizedAt = now;
        user.UpdatedAt = now;

        var addresses = await db.Addresses.Where(a => a.UserId == user.Id).ToListAsync(ct);
        db.Addresses.RemoveRange(addresses);
        var tokens = await db.RefreshTokens.Where(t => t.UserId == user.Id && t.RevokedAt == null).ToListAsync(ct);
        foreach (var t in tokens) t.RevokedAt = now;
        db.Favorites.RemoveRange(await db.Favorites.Where(f => f.UserId == user.Id).ToListAsync(ct));
        db.CartItems.RemoveRange(await db.CartItems.Where(c => c.UserId == user.Id).ToListAsync(ct));

        var questions = await db.Questions.Where(q => q.UserId == user.Id).ToListAsync(ct);
        foreach (var q in questions) q.AskedByName = "Cliente";
        var reviews = await db.Reviews.Where(r => r.UserId == user.Id).ToListAsync(ct);
        foreach (var r in reviews) r.AuthorName = "Cliente";

        var orderList = await db.Orders.Where(o => o.UserId == user.Id).ToListAsync(ct);
        foreach (var o in orderList)
            o.ShippingAddress = o.ShippingAddress with { RecipientName = "Destinatário removido", Phone = null, Complement = null, Street = "—", Number = "—" };
        var payments = await db.Payments.Where(p => p.UserId == user.Id).ToListAsync(ct);
        foreach (var p in payments) p.PayerDocument = null;
    }
}
