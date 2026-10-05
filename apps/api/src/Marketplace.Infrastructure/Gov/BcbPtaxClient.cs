using System.Globalization;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;
using Marketplace.Infrastructure.RemessaConforme;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Gov;

/// <summary>
/// PTAX do Banco Central (API Olinda, pública): cotação de venda do dólar do último dia útil, usada para converter o valor
/// aduaneiro e aplicar a faixa de US$ 50. <c>GET {BaseUrl}/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)</c>.
/// </summary>
public sealed class BcbPtaxClient(HttpClient http, IOptions<PtaxOptions> options, TimeProvider clock)
{
    public const string ProviderName = "bcb-ptax";
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    /// <summary>Última PTAX de venda dos últimos 10 dias (cobre feriados), como fração exata em centésimos de milésimo.</summary>
    public async Task<ExternalExchangeRate?> LatestUsdBrlAsync(CancellationToken ct)
    {
        var today = clock.GetUtcNow().ToOffset(TimeSpan.FromHours(-3)).Date;
        var from = today.AddDays(-10);
        var url = $"{options.Value.BaseUrl.TrimEnd('/')}/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
                  $"?@dataInicial='{from:MM-dd-yyyy}'&@dataFinalCotacao='{today:MM-dd-yyyy}'&$top=100&$format=json&$select=cotacaoVenda,dataHoraCotacao";
        using var doc = JsonDocument.Parse(await http.GetStringAsync(url, ct));
        var last = doc.RootElement.GetProperty("value").EnumerateArray()
            .Select(v => new
            {
                Sell = v.GetProperty("cotacaoVenda").GetDecimal(),
                At = DateTime.ParseExact(v.GetProperty("dataHoraCotacao").GetString()!.Split('.')[0], "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
            })
            .OrderBy(v => v.At)
            .LastOrDefault();
        if (last is null || last.Sell <= 0) return null;
        // 5,22380 BRL por USD → 522380 / 100000 (1 centavo de dólar vale 5,2238 centavos de real).
        var numerator = (long)Math.Round(last.Sell * 100_000m, MidpointRounding.AwayFromZero);
        var quotedAt = DateTime.SpecifyKind(last.At.AddHours(3), DateTimeKind.Utc);
        return new ExternalExchangeRate(CurrencyCode.USD, CurrencyCode.BRL, numerator, 100_000,
            $"US$ 1,00 = R$ {last.Sell.ToString("0.0000", PtBr)} (PTAX venda {last.At:dd/MM/yyyy})", quotedAt);
    }
}
