using System.Security.Claims;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Domain;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Marketplace.Api.Infrastructure;

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private HttpContext? Context => accessor.HttpContext;
    private ClaimsPrincipal? Principal => Context?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true && UserId is not null;

    public Guid? UserId
    {
        get
        {
            var sub = Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(sub, out var id) ? id : null;
        }
    }

    public string? Email => Principal?.FindFirstValue(JwtRegisteredClaimNames.Email) ?? Principal?.FindFirstValue(ClaimTypes.Email);

    public IReadOnlyList<UserRole> Roles =>
        Principal?.FindAll(ClaimTypes.Role).Select(c => Enum.TryParse<UserRole>(c.Value, out var r) ? r : (UserRole?)null)
            .Where(r => r is not null).Select(r => r!.Value).ToList() ?? [];

    /// <summary>IP do cliente após UseForwardedHeaders (nunca o header X-Forwarded-For bruto, que qualquer cliente pode forjar).</summary>
    public string? IpAddress => Context?.Connection.RemoteIpAddress?.ToString();

    public string? UserAgent => Context?.Request.Headers.UserAgent.FirstOrDefault();

    public string Locale => Messages.NormalizeLocale(Context?.Request.Headers.AcceptLanguage.FirstOrDefault());

    public Guid RequireUserId() => UserId ?? throw AppException.Unauthorized();
}
