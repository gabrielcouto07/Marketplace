using Marketplace.Domain;
using Marketplace.Domain.Entities;

namespace Marketplace.Application.Abstractions;

/// <summary>Usuário autenticado na requisição atual (claims do JWT).</summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    Guid? UserId { get; }
    string? Email { get; }
    IReadOnlyList<UserRole> Roles { get; }
    string? IpAddress { get; }
    string? UserAgent { get; }
    /// <summary>Locale negociado por Accept-Language: "pt-BR" (padrão) ou "es-PY".</summary>
    string Locale { get; }

    Guid RequireUserId();
}

public sealed record IssuedAccessToken(string Token, DateTime ExpiresAt);

public interface IJwtTokenService
{
    IssuedAccessToken IssueAccessToken(User user);
}

public interface IPasswordService
{
    string Hash(string password);
    bool Verify(string hash, string password);
}

public sealed record GoogleIdentity(string Subject, string Email, string? Name, string? Picture, bool EmailVerified);

public interface IGoogleTokenVerifier
{
    bool IsConfigured { get; }
    Task<GoogleIdentity?> VerifyAsync(string idToken, CancellationToken ct);
}

/// <summary>Monta URLs públicas (site e API) para e-mails, PDFs, rastreio e compartilhamento.</summary>
public interface ILinkBuilder
{
    string SiteUrl { get; }
    string ApiUrl { get; }
    string Product(string slug);
    string Seller(string slug);
    string Order(Guid orderId);
    string PaymentPage(Guid paymentId);
    string BoletoPdf(Guid paymentId);
    string PasswordReset(string token);
    /// <summary>Página de rastreio na transportadora (null quando não há template para ela).</summary>
    string? Tracking(string trackingCode, string? carrier);
    string PrivacyPolicy();
    string Terms();
}
