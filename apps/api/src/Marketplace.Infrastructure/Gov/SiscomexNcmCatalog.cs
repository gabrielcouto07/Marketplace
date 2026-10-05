using System.Text.Json;
using System.Text.RegularExpressions;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Compliance;
using Marketplace.Infrastructure.RemessaConforme;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Gov;

/// <summary>
/// Tabela NCM vigente, baixada do endpoint público do Portal Único (classif/api/publico/nomenclatura/download/json, sem
/// chave) e guardada em <c>Ncm:CachePath</c>. Só códigos de 8 dígitos valem para a declaração; a descrição junta a
/// posição (4 dígitos) e o item, porque muitos itens se chamam apenas "Outros".
/// </summary>
public sealed partial class SiscomexNcmCatalog(IHttpClientFactory httpFactory, IOptions<NcmOptions> options, ILogger<SiscomexNcmCatalog> logger) : INcmCatalog
{
    public const string HttpClientName = "ncm";

    private HttpClient http => httpFactory.CreateClient(HttpClientName);

    private volatile Snapshot? _snapshot;
    private readonly SemaphoreSlim _lock = new(1, 1);

    private sealed record Snapshot(IReadOnlyDictionary<string, NcmEntry> Leaves, string Version, DateTime LoadedAt);

    public bool IsLoaded => _snapshot is not null;
    public string? Version => _snapshot?.Version;
    public int Count => _snapshot?.Leaves.Count ?? 0;
    public DateTime? LoadedAt => _snapshot?.LoadedAt;

    public Task<NcmEntry?> FindAsync(string code, CancellationToken ct) =>
        Task.FromResult(_snapshot is { } s && s.Leaves.TryGetValue(code, out var e) ? e : null);

    public Task<IReadOnlyList<NcmEntry>> SearchAsync(string text, int limit, CancellationToken ct)
    {
        if (_snapshot is not { } s || string.IsNullOrWhiteSpace(text)) return Task.FromResult<IReadOnlyList<NcmEntry>>([]);
        var digits = new string(text.Where(char.IsAsciiDigit).ToArray());
        IEnumerable<NcmEntry> hits = digits.Length >= 2 && digits.Length == text.Count(c => !char.IsWhiteSpace(c) && c != '.')
            ? s.Leaves.Values.Where(e => e.Code.StartsWith(digits, StringComparison.Ordinal))
            : s.Leaves.Values.Where(e => e.Description.Contains(text.Trim(), StringComparison.OrdinalIgnoreCase));
        return Task.FromResult<IReadOnlyList<NcmEntry>>(hits.OrderBy(e => e.Code).Take(Math.Clamp(limit, 1, 50)).ToList());
    }

    /// <summary>Carrega do cache local; se não houver (ou estiver velho), baixa do Siscomex. Falha mantém a versão anterior.</summary>
    public async Task RefreshAsync(bool forceDownload, CancellationToken ct)
    {
        var o = options.Value;
        if (o.Source.Equals("Offline", StringComparison.OrdinalIgnoreCase)) return;
        await _lock.WaitAsync(ct);
        try
        {
            var path = Path.GetFullPath(o.CachePath);
            var fresh = File.Exists(path) && File.GetLastWriteTimeUtc(path) > DateTime.UtcNow.AddHours(-Math.Max(1, o.RefreshHours));
            if (_snapshot is null && File.Exists(path) && (fresh || !forceDownload))
            {
                _snapshot = Parse(await File.ReadAllTextAsync(path, ct));
                logger.LogInformation("Tabela NCM carregada do cache ({Count} códigos, {Version})", _snapshot.Leaves.Count, _snapshot.Version);
                if (fresh && !forceDownload) return;
            }
            if (fresh && !forceDownload) return;

            var json = await http.GetStringAsync(o.Url, ct);
            var snapshot = Parse(json);
            if (snapshot.Leaves.Count < 5000) throw new InvalidOperationException($"Tabela NCM com só {snapshot.Leaves.Count} códigos; mantendo a anterior.");
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.WriteAllTextAsync(path, json, ct);
            _snapshot = snapshot;
            logger.LogInformation("Tabela NCM atualizada do Siscomex ({Count} códigos, {Version})", snapshot.Leaves.Count, snapshot.Version);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Não foi possível atualizar a tabela NCM; {State}", _snapshot is null ? "validando só o formato" : "mantendo a versão em memória");
        }
        finally
        {
            _lock.Release();
        }
    }

    private static Snapshot Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var version = string.Join(" · ", new[] { Str(root, "Ato"), Str(root, "Data_Ultima_Atualizacao_NCM") }.Where(x => !string.IsNullOrWhiteSpace(x)));
        var all = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var item in root.GetProperty("Nomenclaturas").EnumerateArray())
        {
            var code = new string((Str(item, "Codigo") ?? "").Where(char.IsAsciiDigit).ToArray());
            var end = Str(item, "Data_Fim");
            if (code.Length == 0 || (end is not null && !end.EndsWith("9999", StringComparison.Ordinal))) continue;
            all[code] = Clean(Str(item, "Descricao") ?? "");
        }
        var leaves = new Dictionary<string, NcmEntry>(StringComparer.Ordinal);
        foreach (var (code, description) in all)
        {
            if (code.Length != 8 || !Ncm.IsWellFormed(code)) continue;
            // O item vem primeiro (muitos se chamam só "Outros"); a posição de 4 dígitos dá o contexto, resumida.
            var heading = all.GetValueOrDefault(code[..4]);
            if (heading is { Length: > 140 }) heading = heading[..140].TrimEnd(' ', ',', ';') + "…";
            var text = heading is null || heading == description ? description : $"{description} · {code[..2]}.{code[2..4]}: {heading}";
            leaves[code] = new NcmEntry(code, text.Length > 400 ? text[..400] : text);
        }
        return new Snapshot(leaves, version, DateTime.UtcNow);
    }

    private static string? Str(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static string Clean(string text) => Spaces().Replace(Tags().Replace(text, ""), " ").Trim().TrimStart('-', ' ').Trim();

    [GeneratedRegex("<[^>]+>")]
    private static partial Regex Tags();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();
}
