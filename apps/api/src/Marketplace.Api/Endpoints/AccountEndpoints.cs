using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Application.Services;
using Marketplace.Domain;
using Marketplace.Infrastructure.Storage;
using Microsoft.AspNetCore.Mvc;

namespace Marketplace.Api.Endpoints;

public static class AccountEndpoints
{
    private const string RefreshCookie = "mktpy_refresh";

    public static RouteGroupBuilder MapAuth(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/auth").WithTags("Autenticação").RequireRateLimiting("auth");

        g.MapPost("/login", async (LoginRequest body, AuthService svc, HttpContext http, CancellationToken ct) =>
            WithCookie(http, await svc.LoginAsync(body, ct)));

        g.MapPost("/register", async (RegisterRequest body, AuthService svc, HttpContext http, CancellationToken ct) =>
            Results.Created("/api/me", WithCookieValue(http, await svc.RegisterAsync(body, ct))));

        g.MapPost("/google", async (GoogleAuthRequest body, AuthService svc, HttpContext http, CancellationToken ct) =>
            WithCookie(http, await svc.GoogleAsync(body, ct)));

        g.MapPost("/forgot-password", async (ForgotPasswordRequest body, AuthService svc, CancellationToken ct) =>
        {
            await svc.ForgotPasswordAsync(body, ct);
            return Results.Accepted();
        });

        g.MapPost("/reset-password", async (ResetPasswordRequest body, AuthService svc, CancellationToken ct) =>
        {
            await svc.ResetPasswordAsync(body, ct);
            return Results.NoContent();
        });

        g.MapPost("/refresh", async (RefreshRequest? body, AuthService svc, HttpContext http, CancellationToken ct) =>
        {
            var token = body?.RefreshToken ?? http.Request.Cookies[RefreshCookie];
            return WithCookie(http, await svc.RefreshAsync(token, ct));
        });

        g.MapPost("/logout", async (RefreshRequest? body, AuthService svc, HttpContext http, CancellationToken ct) =>
        {
            var token = body?.RefreshToken ?? http.Request.Cookies[RefreshCookie];
            await svc.LogoutAsync(token, ct);
            http.Response.Cookies.Delete(RefreshCookie, new CookieOptions { Path = "/api/auth" });
            return Results.NoContent();
        }).AllowAnonymous();

        return api;
    }

    private static IResult WithCookie(HttpContext http, AuthResponseDto session) => Results.Ok(WithCookieValue(http, session));

    /// <summary>Refresh token também em cookie httpOnly (útil quando o front é servido pela mesma origem via proxy).</summary>
    private static AuthResponseDto WithCookieValue(HttpContext http, AuthResponseDto session)
    {
        http.Response.Cookies.Append(RefreshCookie, session.RefreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = http.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/api/auth",
            Expires = DateTimeOffset.UtcNow.AddDays(30),
        });
        return session;
    }

    public static RouteGroupBuilder MapAccount(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/me").WithTags("Conta").RequireAuthorization();

        g.MapGet("", (AccountService svc, CancellationToken ct) => svc.MeAsync(ct));
        g.MapPut("", (UpdateProfileRequest body, AccountService svc, CancellationToken ct) => svc.UpdateProfileAsync(body, ct));
        g.MapDelete("", async ([FromBody] DeleteAccountRequest? body, PrivacyService svc, HttpContext http, CancellationToken ct) =>
        {
            await svc.DeleteAccountAsync(body ?? new DeleteAccountRequest(null, null), ct);
            http.Response.Cookies.Delete(RefreshCookie, new CookieOptions { Path = "/api/auth" });
            return Results.NoContent();
        });

        g.MapGet("/addresses", (AccountService svc, CancellationToken ct) => svc.AddressesAsync(ct));
        g.MapPost("/addresses", async (AddressInput body, AccountService svc, CancellationToken ct) =>
        {
            var created = await svc.CreateAddressAsync(body, ct);
            return Results.Created($"/api/me/addresses/{created.Id}", created);
        });
        g.MapPut("/addresses/{id:guid}", (Guid id, AddressInput body, AccountService svc, CancellationToken ct) => svc.UpdateAddressAsync(id, body, ct));
        g.MapDelete("/addresses/{id:guid}", async (Guid id, AccountService svc, CancellationToken ct) =>
        {
            await svc.DeleteAddressAsync(id, ct);
            return Results.NoContent();
        });

        g.MapGet("/favorites", (AccountService svc, CancellationToken ct) => svc.FavoritesAsync(ct));
        g.MapPut("/favorites", (List<FavoriteDto> body, AccountService svc, CancellationToken ct) => svc.ReplaceFavoritesAsync(body, ct));
        g.MapGet("/cart", (AccountService svc, CancellationToken ct) => svc.CartAsync(ct));
        g.MapPut("/cart", (CartDto body, AccountService svc, CancellationToken ct) => svc.ReplaceCartAsync(body.Lines, ct));

        // LGPD — direitos do titular
        g.MapGet("/consents", (PrivacyService svc, CancellationToken ct) => svc.ConsentsAsync(ct));
        g.MapPost("/consents", (ConsentInput body, PrivacyService svc, CancellationToken ct) => svc.UpdateConsentAsync(body, ct));
        g.MapGet("/data-export", (PrivacyService svc, CancellationToken ct) => svc.ExportAsync(ct))
            .RequireRateLimiting("sensitive");

        return api;
    }

    public static RouteGroupBuilder MapPrivacy(this RouteGroupBuilder api)
    {
        api.MapGet("/privacy/policy", (PrivacyService svc, CancellationToken ct) => svc.PolicyAsync(ct)).WithTags("LGPD");
        return api;
    }

    public sealed record UploadRequest(string? FileName, string? ContentType, long SizeBytes);

    public static RouteGroupBuilder MapMedia(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("").WithTags("Imagens");

        g.MapPost("/seller/uploads", (UploadRequest body, IImageStorage storage, CancellationToken ct) =>
            {
                new ValidationErrors()
                    .AddIf(string.IsNullOrWhiteSpace(body.FileName), "fileName", "Informe o nome do arquivo.")
                    .AddIf(string.IsNullOrWhiteSpace(body.ContentType), "contentType", "Informe o tipo do arquivo.")
                    .ThrowIfAny();
                return storage.CreateUploadAsync(body.FileName!, body.ContentType!, body.SizeBytes, ct);
            })
            .RequireAuthorization(p => p.RequireRole(nameof(UserRole.Vendedor), nameof(UserRole.Admin)));

        // Upload direto (provider Local): PUT com o token assinado emitido em /seller/uploads.
        g.MapPut("/media/{**key}", async (string key, string token, HttpRequest request, IServiceProvider sp, CancellationToken ct) =>
        {
            var local = sp.GetService<LocalImageStorage>() ?? throw AppException.NotFound("Upload local");
            var claims = local.ValidateToken(token) ?? throw AppException.Unauthorized("Token de upload inválido ou expirado.");
            if (claims.Key != key) throw AppException.Unauthorized("Token não corresponde ao arquivo.");
            if (request.ContentLength is { } len && len > claims.Size) throw AppException.Validation("sizeBytes", "Arquivo maior que o declarado.");
            await local.SaveAsync(key, request.Body, ct);
            return Results.NoContent();
        }).DisableAntiforgery();

        return api;
    }
}
