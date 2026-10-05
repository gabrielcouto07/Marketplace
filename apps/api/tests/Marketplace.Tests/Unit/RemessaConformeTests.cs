using System.Text;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Services;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Compliance;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Gov;
using Marketplace.Infrastructure.RemessaConforme;

namespace Marketplace.Tests.Unit;

public class ImportTaxBreakdownTests
{
    private static readonly ExchangeRate Usd = new() { From = CurrencyCode.USD, To = CurrencyCode.BRL, Numerator = 540, Denominator = 100, DisplayRate = "US$ 1,00 = R$ 5,40" };

    private static PlatformSettings Rc(Action<PlatformSettings>? configure = null)
    {
        var s = new PlatformSettings { ImportTaxMode = ImportTaxMode.RemessaConforme, IcmsBasisPoints = 1700 };
        configure?.Invoke(s);
        return s;
    }

    [Fact]
    public void LowTier_ItemizesEveryTax()
    {
        // R$ 80 + R$ 20 de frete = R$ 100 ≈ US$ 18,52 → II 20% = 20,00; ICMS por dentro sobre 120 = 24,58.
        var t = ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(8000), Money.Brl(2000), Money.ZeroBrl, "SP"), Rc(), Usd);
        Assert.Equal(ImportTaxRegime.RemessaConforme, t.Regime);
        Assert.True(t.IsFinal);
        Assert.Equal(10000, t.CustomsValue.Amount);
        Assert.Equal(1852, t.CustomsValueUsdCents);
        Assert.Equal(2000, t.ImportDuty.Amount);
        Assert.Equal(ImportTaxCalculator.LowTierBasisPoints, t.ImportDutyBasisPoints);
        Assert.Equal(2458, t.Icms.Amount);
        Assert.Equal(0, t.Ibs.Amount);
        Assert.Equal(0, t.Cbs.Amount);
        Assert.Equal(4458, t.TotalTaxes.Amount);
        Assert.Equal(14458, t.Total.Amount);
        Assert.Equal("US$ 1,00 = R$ 5,40", t.UsdRate!.Display);
    }

    [Fact]
    public void HighTier_DeductsTwentyDollars_AndAppliesIbsCbsAndStateIcms()
    {
        var settings = Rc(s =>
        {
            s.IcmsStateOverrides = "RJ=2000";
            s.IbsStateBasisPoints = 10;
            s.IbsMunicipalBasisPoints = 5;
            s.CbsBasisPoints = 90;
        });
        var t = ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(100000), Money.ZeroBrl, Money.ZeroBrl, "rj"), settings, Usd);
        Assert.Equal(6000, t.ImportDutyBasisPoints);
        Assert.Equal(10800, t.ImportDutyDeduction.Amount);
        Assert.Equal(60000 - 10800, t.ImportDuty.Amount);
        Assert.Equal("RJ", t.IcmsState);
        Assert.Equal(2000, t.IcmsBasisPoints);
        var baseWithDuty = 100000 + 49200;
        Assert.Equal(Money.RoundDiv(baseWithDuty * 10_000L, 8000) - baseWithDuty, t.Icms.Amount);
        Assert.Equal(Money.Brl(baseWithDuty).MultiplyBasisPoints(10).Amount, t.IbsState.Amount);
        Assert.Equal(Money.Brl(baseWithDuty).MultiplyBasisPoints(5).Amount, t.IbsMunicipal.Amount);
        Assert.Equal(Money.Brl(baseWithDuty).MultiplyBasisPoints(90).Amount, t.Cbs.Amount);
        Assert.Equal(t.ImportDuty.Amount + t.Icms.Amount + t.Ibs.Amount + t.Cbs.Amount, t.TotalTaxes.Amount);
    }

    [Fact]
    public void InsuranceAndExpenses_EnterTheCustomsValue()
    {
        var t = ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(10000), Money.Brl(1000), Money.Brl(500)),
            Rc(s => { s.InsuranceBasisPoints = 100; s.OtherExpensesAmount = 250; }), Usd);
        Assert.Equal(100, t.Insurance.Amount);
        Assert.Equal(250, t.OtherExpenses.Amount);
        Assert.Equal(10000 + 1000 + 100 + 250 - 500, t.CustomsValue.Amount);
    }

    [Fact]
    public void AboveThreeThousandDollars_IsFlagged()
    {
        var t = ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(1_700_000), Money.ZeroBrl, Money.ZeroBrl), Rc(), Usd);
        Assert.True(t.ExceedsSimplifiedLimit);
    }

    [Fact]
    public void FlatMode_IsAnEstimate()
    {
        var t = ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(10000), Money.ZeroBrl, Money.ZeroBrl),
            new PlatformSettings { ImportTaxMode = ImportTaxMode.Flat, ImportTaxBasisPoints = 6000 }, Usd);
        Assert.Equal(ImportTaxRegime.Estimativa, t.Regime);
        Assert.False(t.IsFinal);
        Assert.Equal(6000, t.TotalTaxes.Amount);
    }

    [Fact]
    public void Sum_AddsShipmentsAndKeepsUniformRates()
    {
        var a = ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(10000), Money.ZeroBrl, Money.ZeroBrl), Rc(), Usd);
        var b = ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(100000), Money.ZeroBrl, Money.ZeroBrl), Rc(), Usd);
        var sum = ImportTaxBreakdown.Sum([a, b]);
        Assert.Equal(a.TotalTaxes.Amount + b.TotalTaxes.Amount, sum.TotalTaxes.Amount);
        Assert.Equal(0, sum.ImportDutyBasisPoints); // 20% e 60%: varia
        Assert.Equal(1700, sum.IcmsBasisPoints);
    }

    [Fact]
    public void DiscountAllocation_LastShipmentAbsorbsRounding()
    {
        var shares = CheckoutService.AllocateDiscount(Money.Brl(1000), [Money.Brl(3333), Money.Brl(3333), Money.Brl(3334)]);
        Assert.Equal(1000, shares.Sum(s => s.Amount));
        Assert.Equal([333, 333, 334], shares.Select(s => s.Amount).ToArray());
    }
}

public class ComplianceRulesTests
{
    [Theory]
    [InlineData("8517.13.00", true)]
    [InlineData("85171300", true)]
    [InlineData("851713", false)]
    [InlineData("98000000", false)]
    [InlineData("00123456", false)]
    public void Ncm_Format(string raw, bool valid) => Assert.Equal(valid, Ncm.IsWellFormed(Ncm.Normalize(raw)));

    [Fact]
    public void Ncm_ProhibitedChaptersAndCategories()
    {
        Assert.NotNull(Ncm.ProhibitionReason("24022000"));
        Assert.NotNull(Ncm.ProhibitionReason("93040000"));
        Assert.Null(Ncm.ProhibitionReason("85171300"));
        Assert.True(Ncm.MatchesCategory("celulares", "85171300"));
        Assert.False(Ncm.MatchesCategory("perfumes", "85171300"));
        Assert.True(Ncm.MatchesCategory("categoria-nova", "85171300"));
        Assert.Equal("8517.13.00", Ncm.Format("85171300"));
    }

    [Theory]
    [InlineData(100_000, 300, 9970, ComplianceBand.Ouro)]
    [InlineData(100_000, 301, 9969, ComplianceBand.Prata)]
    [InlineData(100_000, 600, 9940, ComplianceBand.Prata)]
    [InlineData(100_000, 601, 9939, ComplianceBand.Bronze)]
    [InlineData(100_000, 1000, 9900, ComplianceBand.Bronze)]
    [InlineData(100_000, 2000, 9800, ComplianceBand.Advertencia)]
    [InlineData(100_000, 2001, 9799, ComplianceBand.Exclusao)]
    [InlineData(0, 0, 10_000, ComplianceBand.Ouro)]
    public void Bands_FollowPortaria193(int shipments, int occurrences, int permyriad, ComplianceBand band)
    {
        Assert.Equal(permyriad, ComplianceBands.CompliancePermyriad(shipments, occurrences));
        Assert.Equal(band, ComplianceBands.BandOf(permyriad));
    }

    [Fact]
    public void Cycle_RunsJulyToJune()
    {
        Assert.Equal(2026, ComplianceBands.CycleStartYear(new DateTime(2026, 10, 5)));
        Assert.Equal(2026, ComplianceBands.CycleStartYear(new DateTime(2027, 6, 30)));
        Assert.Equal(2027, ComplianceBands.CycleStartYear(new DateTime(2027, 7, 1)));
    }

    [Theory]
    [InlineData("Capa para iPhone 15 Pro", "iPhone")]
    [InlineData("Perfume CHANEL nº 5", "Chanel")]
    [InlineData("Tênis Nike Air", "Nike")]
    [InlineData("Applesauce orgânico", null)]
    [InlineData("Fone Bluetooth com cancelamento de ruído", null)]
    public void BrandWatch_MatchesWholeWords(string name, string? expected) =>
        Assert.Equal(expected, BrandWatch.FindProtectedBrand(name, ["Apple", "iPhone", "Chanel", "Nike"]));

    [Fact]
    public void S10_CheckDigit()
    {
        Assert.Equal(5, S10.CheckDigit("12345678"));
        Assert.Equal("SB123456785PY", S10.Build("SB", 12345678, "PY"));
        Assert.True(S10.IsValid("SB123456785PY"));
        Assert.False(S10.IsValid("SB123456784PY"));
    }

    [Fact]
    public void IcmsOverrides_Parse()
    {
        var map = PlatformSettings.ParseIcmsOverrides("sp=2000; RJ=1800, xx=abc");
        Assert.Equal(2000, map["SP"]);
        Assert.Equal(1800, map["RJ"]);
        Assert.Equal(2, map.Count);
        Assert.Equal(1700, new PlatformSettings().IcmsBasisPointsFor("MG"));
    }

    [Theory]
    [InlineData(1, "Valor da mercadoria arbitrado pela fiscalização", ComplianceIndicator.Subvaloracao)]
    [InlineData(2, "Mercadoria contrafeita (marca falsificada)", ComplianceIndicator.Contrafacao)]
    [InlineData(3, "CPF do destinatário inválido", ComplianceIndicator.QualidadeDeclaracao)]
    [InlineData(4, "Descrição genérica da mercadoria", ComplianceIndicator.QualidadeDeclaracao)]
    [InlineData(5, "Remessa aguardando presença de carga", null)]
    public void Siscomex_ClassifiesByKeyword(int code, string text, ComplianceIndicator? expected) =>
        Assert.Equal(expected, SiscomexSyncService.Classify(code, text, "oc", new Dictionary<string, string>()));

    [Fact]
    public void Siscomex_ConfiguredMapWins()
    {
        var map = new Dictionary<string, string> { ["oc:5"] = "Contrafacao", ["oc:3"] = "Ignorar" };
        Assert.Equal(ComplianceIndicator.Contrafacao, SiscomexSyncService.Classify(5, "qualquer", "oc", map));
        Assert.Null(SiscomexSyncService.Classify(3, "CPF do destinatário inválido", "oc", map));
    }

    [Theory]
    [InlineData("0", "Regular", TaxpayerSituation.Regular)]
    [InlineData("3", "Titular Falecido", TaxpayerSituation.TitularFalecido)]
    [InlineData("8", "Nula", TaxpayerSituation.Nula)]
    [InlineData(null, "Cancelada de Ofício", TaxpayerSituation.Cancelada)]
    [InlineData(null, "Pendente de Regularização", TaxpayerSituation.PendenteDeRegularizacao)]
    public void Serpro_MapsSituation(string? code, string description, TaxpayerSituation expected) =>
        Assert.Equal(expected, SerproTaxpayerRegistry.MapSituation(code, description));
}

public class SiscomexParseTests
{
    [Fact]
    public void Parse_ReadsEceShipmentsWithOccurrences()
    {
        const string json = """
        {
          "cnpj": "12345678000199",
          "dataHoraProcessamento": "2026-10-05T10:00:00.000",
          "erros": [],
          "manifestos": [{
            "numeroManifesto": "MAN000000000001",
            "remessas": [{
              "numeroRemessa": "SB123456785PY",
              "situacao": 4,
              "dir": { "numeroDeclaracao": "260000000123" },
              "txCambioDtRegistro": 5.22380,
              "valorRemessaReal": 150.00,
              "valorTributavelReal": 210.00,
              "ii": { "valorDevido": 42.00 },
              "selecoes": [{ "idOrgaoResponsavelSelecao": "RFB", "situacaoFiscalizacao": "1" }],
              "ocorrencias": [{ "idOcorrencia": 991, "codOcorrencia": 105, "nomeOcorrencia": "CPF do destinatário inválido", "resolvida": "0", "dataInsercao": "2026-10-04T09:00:00.000" }],
              "divergencias": [{ "codigoDivergencia": 7, "justificativa": "Valor declarado incompatível", "vigente": "S" }]
            }]
          }]
        }
        """;
        using var doc = JsonDocument.Parse(json);
        var result = PortalUnicoSiscomexClient.Parse(doc.RootElement);
        Assert.True(result.Completed);
        var s = Assert.Single(result.Shipments);
        Assert.Equal("SB123456785PY", s.ShipmentNumber);
        Assert.Equal("260000000123", s.DirNumber);
        Assert.Equal(4, s.StatusCode);
        Assert.True(s.UnderInspection);
        Assert.Equal(210.00m, s.TaxableValueBrl);
        Assert.Equal(42.00m, s.ImportDutyBrl);
        Assert.Equal(105, Assert.Single(s.Occurrences).Code);
        Assert.True(Assert.Single(s.Divergences).Active);
    }

    [Fact]
    public void Parse_NotProcessedYet()
    {
        using var doc = JsonDocument.Parse("""{ "cnpj": "1", "manifestos": [] }""");
        Assert.False(PortalUnicoSiscomexClient.Parse(doc.RootElement).Completed);
    }
}

public class LabelPdfTests
{
    [Fact]
    public void Code128_TableIsConsistent() => Assert.True(LabelPdf.Code128.TableIsConsistent());

    [Fact]
    public void Code128_Checksum()
    {
        // "PJJ123C": 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879; 879 mod 103 = 55.
        var codes = LabelPdf.Code128.Encode("PJJ123C");
        Assert.Equal(104, codes[0]);
        Assert.Equal(55, codes[^2]);
        Assert.Equal(106, codes[^1]);
    }

    [Fact]
    public void Build_ProducesPdfWithPlatformIdentityAndTracking()
    {
        var platform = new PlatformIdentity("Paraguai Imports", "Paraguai Imports", "Paraguai Imports Ltda.", "CNPJ", "12345678000199", "BR", "Rua A, 1", "ADE Coana nº 1/2026", null, null);
        var party = new RemessaParty("Gabriel Demo", "CPF", "52998224725", "Avenida Paulista, 1578 – Bela Vista", "São Paulo", "SP", "01310100", "BR", null, null);
        var sender = new RemessaParty("TecnoCentro CDE", "RUC", "80012345-0", "Av. Monseñor Rodríguez 120", "Ciudad del Este", null, "7000", "PY", null, null);
        var taxes = new RemessaTaxes(Money.Brl(2000), Money.Brl(2458), Money.ZeroBrl, Money.ZeroBrl, Money.ZeroBrl, Money.Brl(4458));
        var request = new RemessaShipmentRequest(Guid.NewGuid(), "PY-2026-000001", new DateTime(2026, 10, 5), platform, sender, party,
            [new RemessaItem(1, "Fone Bluetooth", "85183000", 1, Money.Brl(10000), Money.Brl(10000), 300, "PY")], "Fone Bluetooth",
            Money.Brl(10000), Money.ZeroBrl, Money.ZeroBrl, Money.ZeroBrl, Money.Brl(10000), 1852, taxes, "RemessaConforme", "US$ 1,00 = R$ 5,40",
            300, null, null, "Correo Paraguayo + Correios");
        var pdf = LabelPdf.Build(request, "SB123456785PY", "Correo Paraguayo + Correios", "SBX-1", sandbox: true);
        var text = Encoding.Latin1.GetString(pdf);
        Assert.StartsWith("%PDF-1.4", text);
        Assert.Contains("PARAGUAI IMPORTS", text);
        Assert.Contains("12.345.678/0001-99", text);
        Assert.Contains("SB123456785PY", text);
        Assert.Contains("***.982.247-**", text);
        Assert.EndsWith("%%EOF", text);
    }

    [Fact]
    public void HttpPayload_UsesDirFieldNames()
    {
        var platform = new PlatformIdentity("Paraguai Imports", "Paraguai Imports", "PI Ltda.", "CNPJ", "12345678000199", "BR", "", null, "OND1", "Operador X");
        var party = new RemessaParty("Gabriel", "CPF", "52998224725", "Rua", "São Paulo", "SP", "01310100", "BR", null, null);
        var taxes = new RemessaTaxes(Money.Brl(2000), Money.Brl(2458), Money.Brl(10), Money.Brl(5), Money.Brl(90), Money.Brl(4563));
        var request = new RemessaShipmentRequest(Guid.NewGuid(), "PY-1", DateTime.UtcNow, platform, party, party,
            [new RemessaItem(1, "Item", "85183000", 2, Money.Brl(5000), Money.Brl(10000), null, "PY")], "Item",
            Money.Brl(10000), Money.ZeroBrl, Money.ZeroBrl, Money.ZeroBrl, Money.Brl(10000), 1852, taxes, "RemessaConforme", null, 500, null, null, null);
        var json = JsonSerializer.Serialize(HttpRemessaCarrierGateway.ToPayload(request));
        using var doc = JsonDocument.Parse(json);
        var remessa = doc.RootElement.GetProperty("remessa");
        Assert.Equal("1", remessa.GetProperty("destinatario").GetProperty("tipoDocumento").GetString());
        Assert.Equal("85183000", remessa.GetProperty("mercadorias")[0].GetProperty("codElementoNcm").GetString());
        var rc = remessa.GetProperty("remessaConforme");
        Assert.Equal("12345678000199", rc.GetProperty("codigoECE").GetString());
        Assert.Equal(20.00m, rc.GetProperty("valorProvII").GetDecimal());
        Assert.Equal(24.58m, rc.GetProperty("valorProvICMS").GetDecimal());
        Assert.Equal(0.90m, rc.GetProperty("valorProvCBS").GetDecimal());
        Assert.Equal("OND1", rc.GetProperty("codigoOND").GetString());
    }
}
