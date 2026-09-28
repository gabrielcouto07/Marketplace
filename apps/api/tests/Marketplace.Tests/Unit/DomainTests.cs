using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Shipping;

namespace Marketplace.Tests.Unit;

public class MoneyTests
{
    [Theory]
    [InlineData(69900, 1000, 6990)]
    [InlineData(65400, 6000, 39240)]
    [InlineData(1, 5000, 1)] // 0,5 → half-up = 1 (igual ao Math.round do JS)
    [InlineData(3, 5000, 2)] // 1,5 → 2
    public void MultiplyBasisPoints_RoundsHalfUp(long amount, int bp, long expected) =>
        Assert.Equal(expected, Money.Brl(amount).MultiplyBasisPoints(bp).Amount);

    [Fact]
    public void Convert_UsesExactFraction()
    {
        var rate = new ExchangeRate { From = CurrencyCode.BRL, To = CurrencyCode.PYG, Numerator = 1389, Denominator = 100, DisplayRate = "" };
        Assert.Equal(new Money(970911, CurrencyCode.PYG), rate.Convert(Money.Brl(69900)));
    }

    [Fact]
    public void Convert_RejectsWrongCurrency() =>
        Assert.Throws<InvalidOperationException>(() => Money.Pyg(10).Convert(CurrencyCode.BRL, CurrencyCode.PYG, 1, 1));

    [Fact]
    public void InstallmentAmount_RoundsUp() => Assert.Equal(3334, Money.Brl(10000).InstallmentAmount(3).Amount);

    [Fact]
    public void Sum_RejectsMixedCurrencies() =>
        Assert.Throws<InvalidOperationException>(() => Money.Sum([Money.Brl(1), Money.Pyg(1)]));
}

public class DocumentsTests
{
    [Theory]
    [InlineData("529.982.247-25", true)]
    [InlineData("52998224725", true)]
    [InlineData("111.111.111-11", false)]
    [InlineData("12345678901", false)]
    [InlineData("", false)]
    public void Cpf(string input, bool valid) => Assert.Equal(valid, Documents.IsValidCpf(input));

    [Theory]
    [InlineData("80012345-0", true)]
    [InlineData("80023456-1", true)]
    [InlineData("800123450", true)]
    [InlineData("80012345-6", false)] // RUC das fixtures do mock: apenas ilustrativo, não passa no módulo 11
    [InlineData("80012345-7", false)]
    [InlineData("abc", false)]
    public void Ruc(string input, bool valid) => Assert.Equal(valid, Documents.IsValidRuc(input));

    [Theory]
    [InlineData("demo@mktpy.com", true)]
    [InlineData("sem-arroba", false)]
    public void Email(string input, bool valid) => Assert.Equal(valid, Documents.IsValidEmail(input));
}

public class DeterministicIdTests
{
    // Valores calculados com o código JS original (apps/web/src/mocks/fixtures/base.ts).
    [Theory]
    [InlineData("category:eletronicos", "7de1121f-48dc-4061-a484-0105694b02c0", 2086979166u)]
    [InlineData("seller:tecnocentro-cde", "75ebba1a-e305-4921-a6af-2c2bf91f5215", 3444688433u)]
    [InlineData("user:demo", "3e6b9512-3e7b-4a54-a135-6ab2b0918000", 3341731039u)]
    [InlineData("product:eletronicos:1", "2e04c53e-c3c0-43df-a3ac-4e45b7647f24", 926485766u)]
    [InlineData("rate:BRL:PYG", "e7ab7ddb-8de5-4d5e-a9a7-c7edeb8a6934", 1926404779u)]
    [InlineData("address:demo:1", "c6b2094e-ddb1-4733-a417-5f52ba1bb28c", 2975185373u)]
    public void MatchesFrontendMock(string key, string guid, uint hash)
    {
        Assert.Equal(hash, DeterministicId.HashString(key));
        Assert.Equal(Guid.Parse(guid), DeterministicId.Guid(key));
    }

    [Theory]
    [InlineData("Smart TV 55\" 4K UHD com HDR e sistema inteligente", "smart-tv-55-4k-uhd-com-hdr-e-sistema-inteligente")]
    [InlineData("Perfume Água de Colônia", "perfume-agua-de-colonia")]
    public void Slugify(string input, string expected) => Assert.Equal(expected, Slug.From(input));
}

public class ImportTaxTests
{
    private static readonly ExchangeRate Usd = new() { From = CurrencyCode.USD, To = CurrencyCode.BRL, Numerator = 540, Denominator = 100, DisplayRate = "" };

    [Fact]
    public void Flat_UsesConfiguredRate()
    {
        var result = ImportTaxCalculator.Estimate(Money.Brl(65400), new PlatformSettings { ImportTaxMode = ImportTaxMode.Flat, ImportTaxBasisPoints = 6000 }, Usd);
        Assert.Equal(39240, result.Tax.Amount);
        Assert.Equal(6000, result.EffectiveBasisPoints);
    }

    [Fact]
    public void RemessaConforme_LowTier_20PercentPlusIcms()
    {
        // R$ 100 ≈ US$ 18,5 → 20% II = R$ 20; ICMS 17% por dentro sobre 120 → 120/0,83 − 120 = 24,58
        var result = ImportTaxCalculator.Estimate(Money.Brl(10000), new PlatformSettings { ImportTaxMode = ImportTaxMode.RemessaConforme, IcmsBasisPoints = 1700 }, Usd);
        Assert.Equal(2000 + 2458, result.Tax.Amount);
        Assert.Equal(4458, result.EffectiveBasisPoints);
    }

    [Fact]
    public void RemessaConforme_HighTier_60PercentMinusDeduction()
    {
        // R$ 1.000 ≈ US$ 185 → 60% = 600 − dedução US$ 20 (R$ 108) = 492; ICMS sobre 1.492
        var result = ImportTaxCalculator.Estimate(Money.Brl(100000), new PlatformSettings { ImportTaxMode = ImportTaxMode.RemessaConforme, IcmsBasisPoints = 1700 }, Usd);
        var expectedIcms = Money.RoundDiv(149200L * 10_000, 8300) - 149200;
        Assert.Equal(49200 + expectedIcms, result.Tax.Amount);
    }

    [Fact]
    public void RemessaConforme_FallsBackToFlatWithoutUsdRate()
    {
        var result = ImportTaxCalculator.Estimate(Money.Brl(10000), new PlatformSettings { ImportTaxMode = ImportTaxMode.RemessaConforme }, null);
        Assert.Equal(6000, result.Tax.Amount);
    }
}

public class OrderStateMachineTests
{
    [Theory]
    [InlineData(OrderStatus.AguardandoPagamento, OrderStatus.Pago, true)]
    [InlineData(OrderStatus.Pago, OrderStatus.Enviado, false)]
    [InlineData(OrderStatus.Enviado, OrderStatus.EmDisputa, true)]
    [InlineData(OrderStatus.Concluido, OrderStatus.Cancelado, false)]
    [InlineData(OrderStatus.EmDisputa, OrderStatus.Reembolsado, true)]
    public void Transitions(OrderStatus from, OrderStatus to, bool allowed) => Assert.Equal(allowed, OrderStateMachine.CanTransition(from, to));

    [Fact]
    public void CancelAndDisputeWindows_MatchFrontend()
    {
        OrderStatus[] cancellable = [OrderStatus.AguardandoPagamento, OrderStatus.Pago, OrderStatus.EmPreparacao];
        OrderStatus[] disputable = [OrderStatus.Enviado, OrderStatus.EmTransitoInternacional, OrderStatus.Entregue];
        foreach (var s in Enum.GetValues<OrderStatus>())
        {
            Assert.Equal(cancellable.Contains(s), OrderStateMachine.CanCancel(s));
            Assert.Equal(disputable.Contains(s), OrderStateMachine.CanDispute(s));
        }
    }
}

public class ShippingTableTests
{
    [Fact]
    public void Economy_SaoPaulo_SingleUnit_MatchesMock()
    {
        var zone = new ShippingZone { Prefix = "0", State = "SP", City = "São Paulo", SurchargeAmount = 0, ExtraDays = 0 };
        var options = TableShippingRateProvider.Compute(Guid.Empty, "0", zone, 1, false);
        Assert.Equal(2490, options[0].Price.Amount);
        Assert.Equal(new DayRange(12, 25), options[0].EstimatedDays);
        Assert.Equal(5990, options[1].Price.Amount);
        Assert.Equal(new DayRange(5, 10), options[1].EstimatedDays);
    }

    [Fact]
    public void Curitiba_TwoUnits_WithNegativeSurcharge()
    {
        var zone = new ShippingZone { Prefix = "8", State = "PR", City = "Curitiba", SurchargeAmount = -400, ExtraDays = -2 };
        var options = TableShippingRateProvider.Compute(Guid.Empty, "8", zone, 2, false);
        Assert.Equal((long)Math.Round((2490 - 400) * 1.35), options[0].Price.Amount);
        Assert.Equal(new DayRange(10, 23), options[0].EstimatedDays);
        Assert.Equal(new DayRange(5, 10), options[1].EstimatedDays);
    }

    [Fact]
    public void FreeShipping_ZeroesEconomyOnly()
    {
        var zone = new ShippingZone { Prefix = "0", State = "SP", City = "São Paulo" };
        var options = TableShippingRateProvider.Compute(Guid.Empty, "0", zone, 1, true);
        Assert.Equal(0, options[0].Price.Amount);
        Assert.True(options[1].Price.Amount > 0);
    }

    [Fact]
    public void OptionIds_AreStableAcrossQuotes()
    {
        var zone = new ShippingZone { Prefix = "0", State = "SP", City = "São Paulo" };
        var seller = Guid.NewGuid();
        Assert.Equal(TableShippingRateProvider.Compute(seller, "0", zone, 1, false)[0].Id, TableShippingRateProvider.Compute(seller, "0", zone, 3, true)[0].Id);
    }
}
