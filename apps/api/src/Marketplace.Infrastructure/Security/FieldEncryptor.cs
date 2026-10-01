using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging;

namespace Marketplace.Infrastructure.Security;

/// <summary>Cifra campos de PII em repouso (CPF, documento do pagador). Chaves via Data Protection.</summary>
public interface IFieldEncryptor
{
    string Protect(string plaintext);
    string Unprotect(string ciphertext);
}

public sealed class DataProtectionFieldEncryptor(IDataProtectionProvider provider, ILogger<DataProtectionFieldEncryptor> logger) : IFieldEncryptor
{
    private const string Prefix = "enc:";
    private readonly IDataProtector _protector = provider.CreateProtector("Marketplace.PII.v1");

    public string Protect(string plaintext) => Prefix + _protector.Protect(plaintext);

    public string Unprotect(string ciphertext)
    {
        // Valores gravados antes da cifragem (ou por seed) ficam legíveis.
        if (!ciphertext.StartsWith(Prefix, StringComparison.Ordinal)) return ciphertext;
        try
        {
            return _protector.Unprotect(ciphertext[Prefix.Length..]);
        }
        catch (Exception ex)
        {
            // Chaves do Data Protection perdidas (volume não persistido) ou dado corrompido: nunca falhar silenciosamente.
            logger.LogError(ex, "Não foi possível decifrar um campo de PII: verifique DataProtection:KeysPath (as chaves precisam persistir entre deploys).");
            return string.Empty;
        }
    }
}

/// <summary>Sem cifragem (testes).</summary>
public sealed class NoopFieldEncryptor : IFieldEncryptor
{
    public string Protect(string plaintext) => plaintext;
    public string Unprotect(string ciphertext) => ciphertext;
}
