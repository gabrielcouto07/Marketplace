using Marketplace.Application.Contracts;
using Marketplace.Application.Services;
using Marketplace.Domain;

namespace Marketplace.Api.Endpoints;

public static class SellerEndpoints
{
    public static RouteGroupBuilder MapSellerPanel(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/seller").WithTags("Painel do vendedor").RequireAuthorization();

        g.MapGet("/cities", () => SellerPanelService.ParaguayCities).AllowAnonymous();

        g.MapPost("/register", async (SellerRegisterRequest body, SellerPanelService svc, CancellationToken ct) =>
            Results.Created("/api/seller/profile", await svc.RegisterAsync(body, ct)));

        g.MapGet("/profile", (SellerPanelService svc, CancellationToken ct) => svc.ProfileAsync(ct));
        g.MapPut("/profile", (SellerProfileInput body, SellerPanelService svc, CancellationToken ct) => svc.UpdateProfileAsync(body, ct));

        g.MapGet("/dashboard", (SellerPanelService svc, CancellationToken ct) => svc.DashboardAsync(ct));

        g.MapGet("/products", (string? status, string? q, int? page, int? pageSize, SellerPanelService svc, CancellationToken ct) =>
            svc.ListProductsAsync(Enum.TryParse<ProductStatus>(status, true, out var s) ? s : null, q, page, pageSize, ct));
        g.MapPost("/products", async (SellerProductInput body, SellerPanelService svc, CancellationToken ct) =>
        {
            var created = await svc.CreateProductAsync(body, ct);
            return Results.Created($"/api/seller/products/{created.Id}", created);
        });
        g.MapGet("/products/{id:guid}", (Guid id, SellerPanelService svc, CancellationToken ct) => svc.GetProductAsync(id, ct));
        g.MapPut("/products/{id:guid}", (Guid id, SellerProductInput body, SellerPanelService svc, CancellationToken ct) => svc.UpdateProductAsync(id, body, ct));
        g.MapDelete("/products/{id:guid}", async (Guid id, SellerPanelService svc, CancellationToken ct) =>
        {
            await svc.ArchiveProductAsync(id, ct);
            return Results.NoContent();
        });

        g.MapGet("/orders", (string? status, int? page, int? pageSize, SellerPanelService svc, CancellationToken ct) =>
            svc.ListOrdersAsync(Enum.TryParse<OrderStatus>(status, out var s) ? s : null, page, pageSize, ct));
        g.MapPost("/orders/{id:guid}/prepare", (Guid id, SellerPanelService svc, CancellationToken ct) => svc.PrepareOrderAsync(id, ct));
        g.MapPost("/orders/{id:guid}/ship", (Guid id, ShipOrderRequest? body, SellerPanelService svc, CancellationToken ct) => svc.ShipOrderAsync(id, body ?? new ShipOrderRequest(null, null), ct));

        // Remessa Conforme: declaração antecipada + etiqueta da plataforma (critérios i e iii)
        g.MapGet("/shipping-policy", (SellerPanelService svc, CancellationToken ct) => svc.ShippingPolicyAsync(ct));
        g.MapPost("/orders/{id:guid}/shipment", async (Guid id, SellerPanelService svc, CancellationToken ct) =>
            Results.Created($"/api/seller/orders/{id}/shipment", await svc.CreateShipmentAsync(id, ct)));
        g.MapGet("/orders/{id:guid}/shipment", (Guid id, SellerPanelService svc, CancellationToken ct) => svc.GetShipmentAsync(id, ct));
        g.MapGet("/orders/{id:guid}/shipment/label", async (Guid id, SellerPanelService svc, CancellationToken ct) =>
        {
            var (pdf, name) = await svc.ShipmentLabelAsync(id, ct);
            return Results.File(pdf, "application/pdf", name);
        });

        return api;
    }
}
