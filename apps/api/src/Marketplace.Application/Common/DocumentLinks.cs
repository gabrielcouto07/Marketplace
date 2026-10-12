using Marketplace.Application.Abstractions;
using Marketplace.Application.Contracts;

namespace Marketplace.Application.Common;

/// <summary>
/// Chaves do armazenamento privado de documentos ("doc/2026/10/…") e links assinados e temporários para abrir os
/// arquivos (Política de Vendedores 9.4). URLs antigas (públicas ou de demonstração) passam como estão.
/// </summary>
public sealed class DocumentLinks(IDownloadTokenService tokens)
{
    public const string KeyPrefix = "doc/";
    public const string RoutePrefix = "/api/documents/";
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

    public static bool IsPrivateKey(string? value) =>
        value is not null && value.StartsWith(KeyPrefix, StringComparison.Ordinal) && !value.Contains("..", StringComparison.Ordinal);

    /// <summary>O que gravar a partir do que o formulário mandou: a chave, o link assinado da API ou uma URL antiga.</summary>
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var v = value.Trim();
        var route = v.IndexOf(RoutePrefix, StringComparison.Ordinal);
        if (route >= 0)
        {
            var path = v[(route + RoutePrefix.Length)..];
            var query = path.IndexOf('?');
            v = Uri.UnescapeDataString(query >= 0 ? path[..query] : path);
        }
        return v;
    }

    /// <summary>Chave do armazenamento privado ou URL (pública antiga, de demonstração ou link externo de evidência).</summary>
    public static bool IsValidReference(string? value) =>
        Normalize(value) is { Length: > 0 and <= 1024 } v &&
        (IsPrivateKey(v) || v.StartsWith('/') || v.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
         v.StartsWith("http://", StringComparison.OrdinalIgnoreCase));

    /// <summary>Link para abrir o arquivo: assinado (30 min) para documentos privados; os demais como estão.</summary>
    public string? Url(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored)) return null;
        if (!IsPrivateKey(stored)) return stored;
        var token = tokens.Issue(DownloadTokenPurposes.Document, stored, Lifetime);
        return $"{RoutePrefix}{stored}?t={Uri.EscapeDataString(token)}";
    }

    public bool Validate(string key, string? token) => IsPrivateKey(key) && tokens.Validate(DownloadTokenPurposes.Document, key, token);

    public DocumentRefDto Ref(string stored) => new(stored, Url(stored)!, Name(stored));

    public IReadOnlyList<DocumentRefDto> Refs(IEnumerable<string> stored) => stored.Where(s => !string.IsNullOrWhiteSpace(s)).Select(Ref).ToList();

    public static string Name(string stored)
    {
        var path = stored.Split('?')[0];
        var slash = path.LastIndexOf('/');
        return slash >= 0 ? path[(slash + 1)..] : path;
    }
}
