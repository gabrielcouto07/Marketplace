using Microsoft.Extensions.DependencyInjection;

namespace Marketplace.Infrastructure.Providers;

/// <summary>Registro (nome → implementação) de um tipo de integração: gateways de pagamento, frete, rastreio, câmbio.</summary>
public sealed record ProviderRegistration<TService>(string Name, Type ImplementationType);

/// <summary>
/// Resolve integrações pelo nome gravado na configuração ou no banco (ex.: <c>Payment.Gateway = "mercadopago"</c>).
/// Adicionar um provedor = implementar a interface e chamar <c>services.AddProvider&lt;TService, TImpl&gt;("nome")</c>.
/// </summary>
public sealed class ProviderCatalog<TService>(IEnumerable<ProviderRegistration<TService>> registrations, IServiceProvider services)
    where TService : class
{
    private readonly Dictionary<string, Type> _types =
        registrations.ToDictionary(r => r.Name, r => r.ImplementationType, StringComparer.OrdinalIgnoreCase);

    public IReadOnlyCollection<string> Names => _types.Keys;

    public bool Contains(string name) => _types.ContainsKey(name);

    public bool TryResolve(string? name, out TService service)
    {
        if (name is not null && _types.TryGetValue(name, out var type))
        {
            service = (TService)services.GetRequiredService(type);
            return true;
        }
        service = null!;
        return false;
    }

    public TService Resolve(string name) =>
        TryResolve(name, out var service)
            ? service
            : throw new InvalidOperationException($"Provedor '{name}' de {typeof(TService).Name} não está registrado. Registrados: {string.Join(", ", Names)}.");

    public IEnumerable<(string Name, TService Service)> ResolveAll()
    {
        foreach (var (name, type) in _types)
            yield return (name, (TService)services.GetRequiredService(type));
    }
}

public static class ProviderRegistrationExtensions
{
    /// <summary>Registra o catálogo genérico (uma vez) — resolve qualquer <c>ProviderCatalog&lt;T&gt;</c>, mesmo sem provedores.</summary>
    public static IServiceCollection AddProviderCatalogs(this IServiceCollection services)
    {
        services.AddScoped(typeof(ProviderCatalog<>), typeof(ProviderCatalog<>));
        return services;
    }

    /// <summary>
    /// Registra <typeparamref name="TImpl"/> sob um nome. <paramref name="registerImplementation"/> = false quando a
    /// implementação já foi registrada de outra forma (ex.: <c>AddHttpClient&lt;TImpl&gt;</c>).
    /// </summary>
    public static IServiceCollection AddProvider<TService, TImpl>(
        this IServiceCollection services,
        string name,
        ServiceLifetime lifetime = ServiceLifetime.Scoped,
        bool registerImplementation = true)
        where TService : class
        where TImpl : class, TService
    {
        if (registerImplementation) services.Add(new ServiceDescriptor(typeof(TImpl), typeof(TImpl), lifetime));
        services.AddSingleton(new ProviderRegistration<TService>(name, typeof(TImpl)));
        return services;
    }
}
