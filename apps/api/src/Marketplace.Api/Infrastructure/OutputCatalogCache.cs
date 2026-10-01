using Marketplace.Application.Abstractions;
using Microsoft.AspNetCore.OutputCaching;

namespace Marketplace.Api.Infrastructure;

/// <summary>Invalida o output cache das rotas públicas de catálogo (tag "catalog") após edições de vendedor/admin.</summary>
public sealed class OutputCatalogCache(IOutputCacheStore store) : ICatalogCache
{
    public const string Tag = "catalog";

    public ValueTask InvalidateAsync(CancellationToken ct) => store.EvictByTagAsync(Tag, ct);

    Task ICatalogCache.InvalidateAsync(CancellationToken ct) => InvalidateAsync(ct).AsTask();
}
