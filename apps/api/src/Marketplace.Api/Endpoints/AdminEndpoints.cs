using Marketplace.Application.Abstractions;
using Marketplace.Application.Contracts;
using Marketplace.Application.Services;
using Marketplace.Domain;

namespace Marketplace.Api.Endpoints;

public static class AdminEndpoints
{
    public static RouteGroupBuilder MapAdmin(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/admin").WithTags("Administração")
            .RequireAuthorization(p => p.RequireRole(nameof(UserRole.Admin)));

        g.MapGet("/overview", (AdminService svc, CancellationToken ct) => svc.OverviewAsync(ct));

        // Usuários
        g.MapGet("/users", (string? q, string? role, bool? blocked, int? page, int? pageSize, AdminService svc, CancellationToken ct) =>
            svc.ListUsersAsync(q, Enum.TryParse<UserRole>(role, true, out var r) ? r : null, blocked, page, pageSize, ct));
        g.MapGet("/users/{id:guid}", (Guid id, AdminService svc, CancellationToken ct) => svc.GetUserAsync(id, ct));
        g.MapPut("/users/{id:guid}", (Guid id, AdminUserUpdateRequest body, AdminService svc, CancellationToken ct) => svc.UpdateUserAsync(id, body, ct));
        g.MapPost("/users/{id:guid}/block", (Guid id, AdminBlockRequest? body, AdminService svc, CancellationToken ct) => svc.SetBlockedAsync(id, true, body, ct));
        g.MapPost("/users/{id:guid}/unblock", (Guid id, AdminService svc, CancellationToken ct) => svc.SetBlockedAsync(id, false, null, ct));
        g.MapDelete("/users/{id:guid}", async (Guid id, AdminService svc, CancellationToken ct) => { await svc.AnonymizeUserAsync(id, ct); return Results.NoContent(); });

        // Vendedores
        g.MapGet("/sellers", (string? q, string? status, int? page, int? pageSize, AdminService svc, CancellationToken ct) =>
            svc.ListSellersAsync(q, Enum.TryParse<SellerStatus>(status, true, out var s) ? s : null, page, pageSize, ct));
        g.MapGet("/sellers/{id:guid}", (Guid id, AdminService svc, CancellationToken ct) => svc.GetSellerAsync(id, ct));
        g.MapPut("/sellers/{id:guid}", (Guid id, AdminSellerUpdateRequest body, AdminService svc, CancellationToken ct) => svc.UpdateSellerAsync(id, body, ct));

        // Produtos
        g.MapGet("/products", (string? q, string? status, Guid? sellerId, int? page, int? pageSize, AdminService svc, CancellationToken ct) =>
            svc.ListProductsAsync(q, Enum.TryParse<ProductStatus>(status, true, out var s) ? s : null, sellerId, page, pageSize, ct));
        g.MapPut("/products/{id:guid}", (Guid id, AdminProductUpdateRequest body, AdminService svc, CancellationToken ct) => svc.UpdateProductAsync(id, body, ct));

        // Pedidos e disputas
        g.MapGet("/orders", (string? status, string? q, Guid? sellerId, Guid? userId, bool? inTransit, int? page, int? pageSize, AdminService svc, CancellationToken ct) =>
            svc.ListOrdersAsync(Enum.TryParse<OrderStatus>(status, true, out var s) ? s : null, q, sellerId, userId, inTransit, page, pageSize, ct));
        g.MapGet("/orders/{id}", (string id, AdminService svc, CancellationToken ct) => svc.GetOrderAsync(id, ct));
        g.MapPost("/orders/{id}/transition", (string id, AdminOrderTransitionRequest body, AdminService svc, CancellationToken ct) => svc.TransitionOrderAsync(id, body, ct));
        g.MapPost("/orders/{id}/disputes/resolve", (string id, AdminDisputeResolveRequest body, AdminService svc, CancellationToken ct) => svc.ResolveDisputeAsync(id, body, ct));

        // Pagamentos
        g.MapGet("/payments", (string? status, string? q, int? page, int? pageSize, AdminService svc, CancellationToken ct) =>
            svc.ListPaymentsAsync(Enum.TryParse<PaymentStatus>(status, true, out var s) ? s : null, q, page, pageSize, ct));
        g.MapPost("/payments/{id:guid}/refund", (Guid id, AdminService svc, CancellationToken ct) => svc.RefundPaymentAsync(id, ct));

        // Repasses
        g.MapGet("/payouts", (string? status, Guid? sellerId, int? page, int? pageSize, AdminService svc, CancellationToken ct) =>
            svc.ListPayoutsAsync(Enum.TryParse<PayoutStatus>(status, true, out var s) ? s : null, sellerId, page, pageSize, ct));
        g.MapPost("/payouts/{id:guid}/mark-paid", (Guid id, AdminService svc, CancellationToken ct) => svc.SetPayoutStatusAsync(id, PayoutStatus.Pago, ct));
        g.MapPost("/payouts/{id:guid}/retry", (Guid id, AdminService svc, CancellationToken ct) => svc.SetPayoutStatusAsync(id, PayoutStatus.Agendado, ct));
        g.MapPost("/payouts/{id:guid}/processing", (Guid id, AdminService svc, CancellationToken ct) => svc.SetPayoutStatusAsync(id, PayoutStatus.Processando, ct));

        // Cupons
        g.MapGet("/coupons", (AdminService svc, CancellationToken ct) => svc.ListCouponsAsync(ct));
        g.MapPost("/coupons", async (CouponInput body, AdminService svc, CancellationToken ct) => Results.Created("/api/admin/coupons", await svc.SaveCouponAsync(null, body, ct)));
        g.MapPut("/coupons/{id:guid}", (Guid id, CouponInput body, AdminService svc, CancellationToken ct) => svc.SaveCouponAsync(id, body, ct));
        g.MapDelete("/coupons/{id:guid}", async (Guid id, AdminService svc, CancellationToken ct) => { await svc.DeleteCouponAsync(id, ct); return Results.NoContent(); });

        // Câmbio
        g.MapGet("/exchange-rates", (AdminService svc, CancellationToken ct) => svc.ListRatesAsync(ct));
        g.MapPost("/exchange-rates", async (ExchangeRateInput body, AdminService svc, CancellationToken ct) => Results.Created("/api/admin/exchange-rates", await svc.CreateRateAsync(body, ct)));

        // Banners e categorias
        g.MapGet("/banners", (AdminService svc, CancellationToken ct) => svc.ListBannersAsync(ct));
        g.MapPost("/banners", async (BannerInput body, AdminService svc, CancellationToken ct) => Results.Created("/api/admin/banners", await svc.SaveBannerAsync(null, body, ct)));
        g.MapPut("/banners/{id:guid}", (Guid id, BannerInput body, AdminService svc, CancellationToken ct) => svc.SaveBannerAsync(id, body, ct));
        g.MapDelete("/banners/{id:guid}", async (Guid id, AdminService svc, CancellationToken ct) => { await svc.DeleteBannerAsync(id, ct); return Results.NoContent(); });
        g.MapPost("/categories", async (CategoryInput body, AdminService svc, CancellationToken ct) => Results.Created("/api/admin/categories", await svc.SaveCategoryAsync(null, body, ct)));
        g.MapPut("/categories/{id:guid}", (Guid id, CategoryInput body, AdminService svc, CancellationToken ct) => svc.SaveCategoryAsync(id, body, ct));

        // Configurações e auditoria
        g.MapGet("/settings", (AdminService svc, CancellationToken ct) => svc.GetSettingsAsync(ct));
        g.MapPut("/settings", (PlatformSettingsDto body, AdminService svc, CancellationToken ct) => svc.UpdateSettingsAsync(body, ct));
        g.MapGet("/audit", (string? q, int? page, int? pageSize, AdminService svc, CancellationToken ct) => svc.ListAuditAsync(q, page, pageSize, ct));

        // ----- Remessa Conforme: conformidade, denúncias, moderação, remessas e integrações -----
        g.MapGet("/compliance", (int? cycle, ComplianceService svc, CancellationToken ct) => svc.DashboardAsync(cycle, ct));
        g.MapGet("/compliance/occurrences", (string? indicator, Guid? sellerId, string? status, int? page, int? pageSize, ComplianceService svc, CancellationToken ct) =>
            svc.ListOccurrencesAsync(Enum.TryParse<ComplianceIndicator>(indicator, true, out var i) ? i : null, sellerId,
                Enum.TryParse<OccurrenceStatus>(status, true, out var s) ? s : null, page, pageSize, ct));
        g.MapPost("/compliance/occurrences", async (ComplianceOccurrenceInput body, ComplianceService svc, CancellationToken ct) =>
            Results.Created("/api/admin/compliance/occurrences", await svc.RegisterOccurrenceAsync(body, ct)));
        g.MapPost("/compliance/occurrences/{id:guid}/status", (Guid id, OccurrenceStatusRequest body, ComplianceService svc, CancellationToken ct) =>
            svc.SetOccurrenceStatusAsync(id, body, ct));

        g.MapGet("/reports", (string? status, int? page, int? pageSize, ComplianceService svc, CancellationToken ct) =>
            svc.ListReportsAsync(Enum.TryParse<ProductReportStatus>(status, true, out var s) ? s : null, page, pageSize, ct));
        g.MapPost("/reports/{id:guid}/resolve", (Guid id, ProductReportResolveRequest body, ComplianceService svc, CancellationToken ct) =>
            svc.ResolveReportAsync(id, body, ct));

        g.MapPost("/products/{id:guid}/moderate", (Guid id, ProductModerationRequest body, ComplianceService svc, CancellationToken ct) =>
            svc.ModerateProductAsync(id, body, ct));
        g.MapPost("/sellers/{id:guid}/verify", (Guid id, SellerVerificationRequest body, AdminService svc, CancellationToken ct) =>
            svc.VerifySellerAsync(id, body, ct));

        g.MapGet("/shipments", (string? status, string? q, int? page, int? pageSize, RemessaService svc, CancellationToken ct) =>
            svc.ListAsync(Enum.TryParse<ShipmentStatus>(status, true, out var s) ? s : null, q, page, pageSize, ct));
        g.MapGet("/shipments/{id:guid}/label", async (Guid id, RemessaService svc, CancellationToken ct) =>
        {
            var (pdf, name) = await svc.AdminLabelAsync(id, ct);
            return Results.File(pdf, "application/pdf", name);
        });
        g.MapPost("/shipments/{id:guid}/retry", (Guid id, RemessaService svc, CancellationToken ct) => svc.RetryAsync(id, ct));

        g.MapGet("/integrations", (IIntegrationStatusReporter svc, CancellationToken ct) => svc.GetAsync(ct));

        return api;
    }
}
