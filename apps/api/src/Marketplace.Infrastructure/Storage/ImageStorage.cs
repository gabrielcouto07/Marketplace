using Amazon.S3;
using Amazon.S3.Model;
using Marketplace.Application.Abstractions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Storage;

public sealed class StorageOptions
{
    /// <summary>"Local" (disco, servido em /media) ou "R2" (Cloudflare R2 / S3 compatível).</summary>
    public string Provider { get; set; } = "Local";
    public string LocalPath { get; set; } = Path.Combine(".data", "media");
    /// <summary>
    /// Base das URLs no provider Local. Relativa ("/api") por padrão: passa pelo proxy do Next (mesma origem, sem
    /// CORS, funciona no celular via LAN). Use a URL absoluta da API quando o front não usar o proxy.
    /// </summary>
    public string LocalPublicBase { get; set; } = "/api";
    public long MaxUploadBytes { get; set; } = 8 * 1024 * 1024;
    public string[] AllowedContentTypes { get; set; } = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    public R2Options R2 { get; set; } = new();

    public sealed class R2Options
    {
        public string AccountId { get; set; } = string.Empty;
        public string AccessKeyId { get; set; } = string.Empty;
        public string SecretAccessKey { get; set; } = string.Empty;
        public string Bucket { get; set; } = string.Empty;
        /// <summary>Domínio público do bucket (r2.dev ou domínio próprio), sem barra final.</summary>
        public string PublicBaseUrl { get; set; } = string.Empty;
        public int PresignMinutes { get; set; } = 15;
    }
}

public static class StorageKeys
{
    public static string NewKey(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (ext.Length is 0 or > 8) ext = ".bin";
        return $"products/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{ext}";
    }

    public static void Validate(StorageOptions options, string contentType, long sizeBytes)
    {
        if (!options.AllowedContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
            throw new Application.Common.AppException(422, "VALIDATION_ERROR", "Formato de imagem não suportado.",
                new Dictionary<string, string[]> { ["contentType"] = ["Use JPEG, PNG, WebP ou AVIF."] });
        if (sizeBytes <= 0 || sizeBytes > options.MaxUploadBytes)
            throw new Application.Common.AppException(422, "VALIDATION_ERROR", "Imagem muito grande.",
                new Dictionary<string, string[]> { ["sizeBytes"] = [$"Tamanho máximo: {options.MaxUploadBytes / 1024 / 1024} MB."] });
    }
}

/// <summary>Disco local: a URL de upload aponta para `PUT /api/media/{key}` protegido por token assinado.</summary>
public sealed class LocalImageStorage(IOptions<StorageOptions> options, IDataProtectionProvider protection) : IImageStorage
{
    private readonly IDataProtector _protector = protection.CreateProtector("Marketplace.Uploads");

    public string RootPath => Path.GetFullPath(options.Value.LocalPath);

    public Task<PresignedUpload> CreateUploadAsync(string fileName, string contentType, long sizeBytes, CancellationToken ct)
    {
        StorageKeys.Validate(options.Value, contentType, sizeBytes);
        var key = StorageKeys.NewKey(fileName);
        var token = _protector.ToTimeLimitedDataProtector().Protect($"{key}|{contentType}|{sizeBytes}", TimeSpan.FromMinutes(15));
        var baseUrl = options.Value.LocalPublicBase.TrimEnd('/');
        var uploadUrl = $"{baseUrl}/media/{key}?token={Uri.EscapeDataString(token)}";
        return Task.FromResult(new PresignedUpload(uploadUrl, $"{baseUrl}/media/{key}", key,
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

    /// <summary>Caminho físico da chave, ou null se sair da pasta de mídia (path traversal).</summary>
    public string? ResolvePath(string key)
    {
        var path = Path.GetFullPath(Path.Combine(RootPath, key.Replace('/', Path.DirectorySeparatorChar)));
        return path.StartsWith(RootPath + Path.DirectorySeparatorChar, StringComparison.Ordinal) ? path : null;
    }

    /// <summary>Grava no máximo <paramref name="maxBytes"/> (o Content-Length não é confiável) e confere a assinatura do arquivo.</summary>
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
                if (total > maxBytes)
                    throw new Application.Common.AppException(413, "PAYLOAD_TOO_LARGE", "Arquivo maior que o declarado.");
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
            throw new Application.Common.AppException(422, "VALIDATION_ERROR", "O arquivo não é uma imagem do tipo declarado.",
                new Dictionary<string, string[]> { ["contentType"] = ["Conteúdo não corresponde ao tipo informado."] });
        }
    }

    public Task DeleteAsync(string storageKey, CancellationToken ct)
    {
        var path = Path.Combine(RootPath, storageKey.Replace('/', Path.DirectorySeparatorChar));
        if (path.StartsWith(RootPath, StringComparison.Ordinal) && File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }
}

/// <summary>Assinaturas (magic bytes) dos formatos aceitos.</summary>
public static class ImageSignatures
{
    public static bool Matches(IReadOnlyList<byte> header, string contentType)
    {
        bool StartsWith(params byte[] prefix) => header.Count >= prefix.Length && prefix.Select((b, i) => header[i] == b).All(x => x);
        return contentType.ToLowerInvariant() switch
        {
            "image/jpeg" => StartsWith(0xFF, 0xD8, 0xFF),
            "image/png" => StartsWith(0x89, 0x50, 0x4E, 0x47),
            "image/webp" => StartsWith(0x52, 0x49, 0x46, 0x46) && header.Count >= 12 && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50,
            "image/avif" => header.Count >= 12 && header[4] == 0x66 && header[5] == 0x74 && header[6] == 0x79 && header[7] == 0x70,
            _ => false,
        };
    }
}

/// <summary>Cloudflare R2 via API S3: URL pré-assinada para PUT direto do navegador.</summary>
public sealed class R2ImageStorage(IOptions<StorageOptions> options) : IImageStorage
{
    private readonly Lazy<IAmazonS3> _client = new(() =>
    {
        var r2 = options.Value.R2;
        return new AmazonS3Client(r2.AccessKeyId, r2.SecretAccessKey, new AmazonS3Config
        {
            ServiceURL = $"https://{r2.AccountId}.r2.cloudflarestorage.com",
            ForcePathStyle = true,
            RequestChecksumCalculation = Amazon.Runtime.RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = Amazon.Runtime.ResponseChecksumValidation.WHEN_REQUIRED,
        });
    });

    public async Task<PresignedUpload> CreateUploadAsync(string fileName, string contentType, long sizeBytes, CancellationToken ct)
    {
        StorageKeys.Validate(options.Value, contentType, sizeBytes);
        var r2 = options.Value.R2;
        var key = StorageKeys.NewKey(fileName);
        var url = await _client.Value.GetPreSignedURLAsync(new GetPreSignedUrlRequest
        {
            BucketName = r2.Bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            ContentType = contentType,
            Expires = DateTime.UtcNow.AddMinutes(r2.PresignMinutes),
        });
        return new PresignedUpload(url, $"{r2.PublicBaseUrl.TrimEnd('/')}/{key}", key,
            new Dictionary<string, string> { ["Content-Type"] = contentType });
    }

    public Task DeleteAsync(string storageKey, CancellationToken ct) =>
        _client.Value.DeleteObjectAsync(options.Value.R2.Bucket, storageKey, ct);
}
