using Marketplace.Application.Abstractions;
using Marketplace.Infrastructure.Providers;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Payments;

public sealed class PaymentOptions
{
    /// <summary>Gateway que cria cobranças novas: "Fake" (dev) ou "MercadoPago". Nomes registrados no catálogo (case-insensitive).</summary>
    public string Provider { get; set; } = FakePaymentGateway.GatewayName;

    /// <summary>Só para ambientes de homologação: permite o gateway fake fora de Development (nunca em produção real).</summary>
    public bool AllowFakeOutsideDevelopment { get; set; }
}

/// <summary>
/// Todos os gateways registrados ficam disponíveis ao mesmo tempo: trocar <c>Payments:Provider</c> muda só as
/// cobranças novas, enquanto consultas, estornos e webhooks das antigas continuam no gateway de origem.
/// </summary>
public sealed class PaymentGatewayRegistry(ProviderCatalog<IPaymentGateway> catalog, IOptions<PaymentOptions> options) : IPaymentGatewayRegistry
{
    private IPaymentGateway? _default;

    public IPaymentGateway Default => _default ??= catalog.Resolve(options.Value.Provider);

    public IReadOnlyCollection<string> Names => catalog.Names;

    public IPaymentGateway Get(string name) => catalog.Resolve(name);

    public bool TryGet(string name, out IPaymentGateway gateway) => catalog.TryResolve(name, out gateway);
}
