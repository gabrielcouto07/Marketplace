using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Storage;

/// <summary>
/// Documentos privados no disco da API (volume persistente em produção): upload por <c>PUT /api/documents/{key}</c> com
/// token assinado e leitura só por link assinado (<see cref="DocumentLinks"/>). Nunca vão para o bucket público das
/// imagens do catálogo.
/// </summary>
public sealed class LocalDocumentStorage(IOptions<StorageOptions> options, IDataProtectionProvider protection) : IDocumentStorage
{
    private readonly IDataProtector _protector = protection.CreateProtector("Marketplace.Documents");

    public string RootPath => Path.GetFullPath(options.Value.DocumentsPath);

    public Task<PresignedUpload> CreateUploadAsync(string fileName, string contentType, long sizeBytes, CancellationToken ct)
    {
        var o = options.Value;
        if (!o.AllowedDocumentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
            throw AppException.Validation("contentType", "Envie PDF, JPEG, PNG ou WebP.");
        if (sizeBytes <= 0 || sizeBytes > o.MaxDocumentBytes)
            throw AppException.Validation("sizeBytes", $"Tamanho máximo: {o.MaxDocumentBytes / 1024 / 1024} MB.");
        var ext = contentType.ToLowerInvariant() switch
        {
            "application/pdf" => ".pdf",
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => ".jpg",
        };
        var key = $"{DocumentLinks.KeyPrefix}{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{ext}";
        var token = _protector.ToTimeLimitedDataProtector().Protect($"{key}|{contentType}|{sizeBytes}", TimeSpan.FromMinutes(15));
        var baseUrl = o.LocalPublicBase.TrimEnd('/');
        return Task.FromResult(new PresignedUpload($"{baseUrl}/documents/{key}?token={Uri.EscapeDataString(token)}", key, key,
            new Dictionary<string, string> { ["Content-Type"] = contentType }));
    }

    public (string Key, string ContentType, long Size)? ValidateToken(string token)
    {
        try
        {
            var parts = _protector.ToTimeLimitedDataProtector().Unprotect(token).Split('|');
            return (parts[0], parts[1], long.Parse(parts[2]));
        }
        catch (Exception)
        {
            return null;
        }
    }

    /// <summary>Caminho físico da chave, ou null se sair da pasta (path traversal) ou não for chave de documento.</summary>
    public string? ResolvePath(string key)
    {
        if (!DocumentLinks.IsPrivateKey(key)) return null;
        var relative = key[DocumentLinks.KeyPrefix.Length..].Replace('/', Path.DirectorySeparatorChar);
        var path = Path.GetFullPath(Path.Combine(RootPath, relative));
        return path.StartsWith(RootPath + Path.DirectorySeparatorChar, StringComparison.Ordinal) ? path : null;
    }

    /// <summary>Grava no máximo o tamanho declarado e confere a assinatura do arquivo (PDF ou imagem).</summary>
    public async Task SaveAsync(string key, Stream content, long maxBytes, string expectedContentType, CancellationToken ct)
    {
        var path = ResolvePath(key) ?? throw new UnauthorizedAccessException();
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var buffer = new byte[64 * 1024];
        long total = 0;
        var header = new List<byte>(16);
        try
        {
            await using var file = File.Create(path);
            int read;
            while ((read = await content.ReadAsync(buffer, ct)) > 0)
            {
                total += read;
                if (total > maxBytes) throw new AppException(413, "PAYLOAD_TOO_LARGE", "Arquivo maior que o declarado.");
                if (header.Count < 16) header.AddRange(buffer.Take(Math.Min(read, 16 - header.Count)));
                await file.WriteAsync(buffer.AsMemory(0, read), ct);
            }
        }
        catch
        {
            try { File.Delete(path); } catch { /* best effort */ }
            throw;
        }
        if (!ImageSignatures.Matches(header, expectedContentType))
        {
            File.Delete(path);
            throw AppException.Validation("contentType", "O arquivo não corresponde ao tipo informado.");
        }
    }

    public Task<StoredDocument?> OpenAsync(string key, CancellationToken ct)
    {
        var path = ResolvePath(key);
        if (path is null || !File.Exists(path)) return Task.FromResult<StoredDocument?>(null);
        var contentType = Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "image/jpeg",
        };
        Stream stream = File.OpenRead(path);
        return Task.FromResult<StoredDocument?>(new StoredDocument(stream, contentType, Path.GetFileName(path)));
    }
}
