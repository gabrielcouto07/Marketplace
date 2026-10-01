using Marketplace.Application.Abstractions;
using Microsoft.AspNetCore.DataProtection;

namespace Marketplace.Infrastructure.Security;

/// <summary>Tokens assinados (Data Protection, com validade) para links abertos sem sessão, ex.: PDF do boleto.</summary>
public sealed class DataProtectionDownloadTokenService(IDataProtectionProvider provider) : IDownloadTokenService
{
    public string Issue(string purpose, string subject, TimeSpan lifetime) =>
        Protector(purpose).Protect(subject, lifetime);

    public bool Validate(string purpose, string subject, string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;
        try
        {
            return Protector(purpose).Unprotect(token) == subject;
        }
        catch (Exception)
        {
            return false;
        }
    }

    private ITimeLimitedDataProtector Protector(string purpose) =>
        provider.CreateProtector($"Marketplace.Download.{purpose}").ToTimeLimitedDataProtector();
}
