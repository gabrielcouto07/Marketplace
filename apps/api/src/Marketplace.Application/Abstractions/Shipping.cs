using Marketplace.Domain.Common;

namespace Marketplace.Application.Abstractions;

/// <summary>Origem da remessa (loja no Paraguai).</summary>
public sealed record ShippingOrigin(Guid SellerId, string City, string Country, string? PostalCode);

/// <summary>Destino (comprador no Brasil). Cidade/UF vêm da consulta de CEP quando disponíveis.</summary>
public sealed record ShippingDestination(string PostalCode, string? City, string? State, string Country = "BR")
{
    /// <summary>Zona Correios (1º dígito do CEP).</summary>
    public string Zone => PostalCode.Length > 0 ? PostalCode[..1] : "0";
}

/// <summary>Dimensões em centímetros.</summary>
public sealed record ParcelDimensions(int LengthCm, int WidthCm, int HeightCm)
{
    /// <summary>Peso cubado (g) com o divisor usual das transportadoras (6000 cm³/kg).</summary>
    public int VolumetricWeightGrams(int divisor = 6000) =>
        (int)Math.Ceiling(LengthCm * (double)WidthCm * HeightCm / divisor * 1000);
}

/// <summary>Item a transportar. Peso/dimensões vêm do cadastro do produto; quando ausentes, o provedor usa defaults.</summary>
public sealed record ShippingItem(
    Guid ProductId,
    Guid? VariantId,
    string Name,
    int Quantity,
    Money UnitPrice,
    int? WeightGrams,
    ParcelDimensions? Dimensions,
    string? HsCode);

/// <summary>Tudo que uma transportadora ou agregador precisa para cotar.</summary>
public sealed record ShippingQuoteContext(
    ShippingOrigin Origin,
    ShippingDestination Destination,
    IReadOnlyList<ShippingItem> Items,
    Money DeclaredValue)
{
    public const int DefaultItemWeightGrams = 500;

    public int TotalUnits => Items.Sum(i => i.Quantity);

    /// <summary>Peso físico total (g), usando o default para itens sem peso cadastrado.</summary>
    public int TotalWeightGrams => Items.Sum(i => (i.WeightGrams ?? DefaultItemWeightGrams) * i.Quantity);

    /// <summary>Maior entre peso físico e cubado — base de cálculo das transportadoras.</summary>
    public int BillableWeightGrams =>
        Math.Max(TotalWeightGrams, Items.Sum(i => (i.Dimensions?.VolumetricWeightGrams() ?? 0) * i.Quantity));
}

/// <summary>Opção devolvida por um provedor. Preço cheio: frete grátis é aplicado pelo ShippingService.</summary>
public sealed record ShippingRateOption(
    Guid Id,
    string Provider,
    string ServiceCode,
    string Carrier,
    string Service,
    Money Price,
    DayRange EstimatedDays,
    string? Description,
    string? ProviderQuoteId = null)
{
    /// <summary>
    /// ID estável por (provedor, serviço, loja, zona do CEP): o checkout recota a cada mudança e precisa reencontrar a
    /// opção escolhida. Provedores com cotação própria devem usar este helper em vez de GUIDs aleatórios.
    /// </summary>
    public static Guid StableId(string provider, string serviceCode, Guid sellerId, ShippingDestination destination) =>
        DeterministicId.Guid($"ship:{provider}:{serviceCode}:{sellerId}:{destination.Zone}");
}

/// <summary>
/// Cotação de frete. Implementações: tabela própria (padrão, sem rede) e integrações com transportadoras ou
/// agregadores (Correios, Melhor Envio, DHL…). Selecione com <c>Shipping:Provider</c>; a tabela fica como fallback.
/// </summary>
public interface IShippingRateProvider
{
    string Name { get; }

    /// <summary>Lista vazia = o provedor não atende este destino (o chamador decide o fallback).</summary>
    Task<IReadOnlyList<ShippingRateOption>> QuoteAsync(ShippingQuoteContext context, CancellationToken ct);
}
