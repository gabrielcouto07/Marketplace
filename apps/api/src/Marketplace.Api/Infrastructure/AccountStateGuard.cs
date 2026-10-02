using System.Security.Claims;
using Marketplace.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Marketplace.Api.Infrastructure;

/// <summary>
/// Bloqueio e exclusão de conta valem na hora, não só quando o JWT expira (60 min): um usuário bloqueado pelo admin
/// perderia o acesso a pedidos, painel do vendedor e até ao /admin só na próxima renovação. A checagem é uma consulta
/// leve por usuário, em cache por 30 s.
/// </summary>
public static class AccountStateGuard
{
    private enum AccountState { Active, Blocked, Gone }

    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    public static IApplicationBuilder UseAccountStateGuard(this IApplicationBuilder app) =>
        app.Use(async (ctx, next) =>
        {
            if (ctx.User.Identity?.IsAuthenticated == true)
            {
                var sub = ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? ctx.User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (Guid.TryParse(sub, out var userId))
                {
                    var state = await ResolveAsync(ctx, userId);
                    if (state == AccountState.Gone)
                    {
                        await ApiProblems.WriteAsync(ctx, 401, "UNAUTHORIZED", "Sessão inválida ou expirada.");
                        return;
                    }
                    if (state == AccountState.Blocked)
                    {
                        await ApiProblems.WriteAsync(ctx, 403, "ACCOUNT_BLOCKED", "Esta conta está bloqueada. Fale com o suporte.");
                        return;
                    }
                }
            }
            await next();
        });

    private static async Task<AccountState> ResolveAsync(HttpContext ctx, Guid userId)
    {
        var cache = ctx.RequestServices.GetRequiredService<IMemoryCache>();
        return await cache.GetOrCreateAsync(CacheKey(userId), async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheTtl;
            var db = ctx.RequestServices.GetRequiredService<IAppDbContext>();
            var user = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.BlockedAt, u.AnonymizedAt })
                .FirstOrDefaultAsync(ctx.RequestAborted);
            if (user is null || user.AnonymizedAt is not null) return AccountState.Gone;
            return user.BlockedAt is not null ? AccountState.Blocked : AccountState.Active;
        });
    }

    /// <summary>Chave do cache por usuário (o admin pode limpar ao bloquear/desbloquear para efeito imediato).</summary>
    public static string CacheKey(Guid userId) => $"account-state:{userId:N}";
}
