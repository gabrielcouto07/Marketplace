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

    public async Task SaveAsync(string key, Stream content, CancellationToken ct)
    {
        var path = ResolvePath(key) ?? throw new UnauthorizedAccessException();
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = File.Create(path);
        await content.CopyToAsync(file, ct);
    }

    public Task DeleteAsync(string storageKey, CancellationToken ct)
    {
        var path = Path.Combine(RootPath, storageKey.Replace('/', Path.DirectorySeparatorChar));
        if (path.StartsWith(RootPath, StringComparison.Ordinal) && File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
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
