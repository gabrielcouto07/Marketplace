using Marketplace.Application.Abstractions;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

/// <summary>Carrega os parâmetros da plataforma uma vez por requisição (linha única, criada sob demanda).</summary>
public sealed class PlatformSettingsProvider(IAppDbContext db, TimeProvider clock)
{
    private PlatformSettings? _cached;

    public async Task<PlatformSettings> GetAsync(CancellationToken ct)
    {
        if (_cached is not null) return _cached;
        var settings = await db.PlatformSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (settings is null)
        {
            settings = new PlatformSettings { Id = 1, UpdatedAt = clock.GetUtcNow().UtcDateTime };
            db.PlatformSettings.Add(settings);
            await db.SaveChangesAsync(ct);
        }
        return _cached = settings;
    }
}
