using System.Text;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Application.Services;
using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Api.Endpoints;

public static class CommerceEndpoints
{
    public static RouteGroupBuilder MapShipping(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("").WithTags("CEP, frete e câmbio");

        // Rotas anônimas que batem em serviços externos (ViaCEP/transportadoras): sem limite, um scraper derruba a cotação de todos.
        g.MapGet("/postal-codes/{cep}", (string cep, ShippingService svc, CancellationToken ct) => svc.LookupAsync(cep, ct))
            .RequireRateLimiting("quotes");

        g.MapPost("/shipping/quotes", (ShippingQuoteRequest body, ShippingService svc, CancellationToken ct) => svc.QuoteAsync(body, ct))
            .RequireRateLimiting("quotes");

        g.MapGet("/exchange-rates", (string? from, string? to, ExchangeRateService svc, CancellationToken ct) =>
            svc.ListAsync(
                Enum.TryParse<CurrencyCode>(from, true, out var f) ? f : null,
                Enum.TryParse<CurrencyCode>(to, true, out var t) ? t : null, ct));

        return api;
    }

    public static RouteGroupBuilder MapCheckoutAndOrders(this RouteGroupBuilder api)
    {
        var checkout = api.MapGroup("").WithTags("Checkout");

        checkout.MapPost("/checkout/quotes", (CheckoutQuoteRequest body, CheckoutService svc, CancellationToken ct) => svc.QuoteAsync(body, ct))
            .RequireRateLimiting("quotes");

        checkout.MapPost("/orders", async (PlaceOrderRequest body, CheckoutService svc, CancellationToken ct) =>
            {
                var response = await svc.PlaceOrderAsync(body, ct);
                return Results.Created($"/api/purchases/{response.PurchaseId}/orders", response);
            })
            .RequireAuthorization();

        var orders = api.MapGroup("").WithTags("Pedidos").RequireAuthorization();

        orders.MapGet("/orders", (string? status, string? group, int? page, int? pageSize, OrderService svc, CancellationToken ct) =>
            svc.ListAsync(Enum.TryParse<OrderStatus>(status, true, out var s) ? s : null, group, page, pageSize, ct));

        orders.MapGet("/orders/{id}", (string id, OrderService svc, CancellationToken ct) => svc.GetAsync(id, ct));

        orders.MapGet("/purchases/{purchaseId:guid}/orders", (Guid purchaseId, OrderService svc, CancellationToken ct) => svc.ByPurchaseAsync(purchaseId, ct));

        orders.MapGet("/orders/{id}/tracking", (string id, OrderService svc, CancellationToken ct) => svc.TrackingAsync(id, ct));

        orders.MapPost("/orders/{id}/cancel", (string id, OrderService svc, CancellationToken ct) => svc.CancelAsync(id, ct));

        orders.MapPost("/orders/{id}/disputes", async (string id, OrderService svc, CancellationToken ct) =>
            Results.Created($"/api/orders/{id}", await svc.OpenDisputeAsync(id, ct)));

        orders.MapPost("/orders/{id}/confirm-receipt", (string id, OrderService svc, CancellationToken ct) => svc.ConfirmReceiptAsync(id, ct));

        return api;
    }

    public static RouteGroupBuilder MapPayments(this RouteGroupBuilder api, bool allowSimulation)
    {
        var g = api.MapGroup("/payments").WithTags("Pagamentos");

        g.MapGet("/{id:guid}", (Guid id, PaymentService svc, CancellationToken ct) => svc.GetAsync(id, ct))
            .RequireAuthorization();

        // Aberto em nova aba/download: aceita o link assinado (t=) emitido na criação do boleto ou a sessão do dono.
        g.MapGet("/{id:guid}/boleto.pdf", async (Guid id, string? t, PaymentService svc, IDownloadTokenService tokens, CancellationToken ct) =>
        {
            var payment = tokens.Validate(DownloadTokenPurposes.Boleto, id.ToString(), t)
                ? await svc.FindAsync(id, ct)
                : await svc.RequireOwnedAsync(id, ct);
            if (payment.Method != PaymentMethod.Boleto || payment.BoletoDigitableLine is null) throw AppException.NotFound("Boleto");
            // Gateways reais devolvem a URL do PDF; o fake gera um PDF simples com a linha digitável.
            if (payment.Gateway != PaymentService.FakeGatewayName && !string.IsNullOrEmpty(payment.BoletoPdfUrl) && payment.BoletoPdfUrl.StartsWith("http"))
                return Results.Redirect(payment.BoletoPdfUrl);
            var pdf = SimplePdf.Build(
            [
                "BOLETO DE DEMONSTRACAO - Marketplace PY",
                $"Pagamento: {payment.Id}",
                $"Valor: R$ {payment.Amount / 100m:N2}",
                $"Vencimento: {payment.BoletoDueDate:dd/MM/yyyy}",
                $"Linha digitavel: {payment.BoletoDigitableLine}",
                $"Codigo de barras: {payment.BoletoBarcode}",
                "Este documento nao tem valor de cobranca.",
            ]);
            return Results.File(pdf, "application/pdf", $"boleto-{payment.Id.ToString()[..8]}.pdf");
        }).AllowAnonymous();

        if (allowSimulation)
        {
            g.MapPost("/{id:guid}/simulate-approval", (Guid id, PaymentService svc, CancellationToken ct) => svc.SimulateApprovalAsync(id, ct))
                .RequireAuthorization()
                .WithDescription("Somente com o gateway fake (dev): aprova o pagamento imediatamente.");
        }

        return api;
    }

    /// <summary>
    /// Webhooks de pagamento (`/webhooks/payments/{gateway}`) e rastreio (`/webhooks/shipping/{provider}`). Cada
    /// provedor valida a própria assinatura; o processamento é idempotente e registrado em webhook_events.
    /// Resposta ≠ 2xx faz o provedor reenviar (inclusive 404 quando a cobrança/pedido ainda não existe).
    /// </summary>
    public static RouteGroupBuilder MapWebhooks(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/webhooks").WithTags("Webhooks").AllowAnonymous().RequireRateLimiting("webhooks");

        g.MapPost("/payments/{gateway}", (string gateway, HttpRequest request, PaymentService svc, CancellationToken ct) =>
            HandlePaymentAsync(gateway, request, svc, ct));

        // Rotas legadas: gateway padrão e alias do Mercado Pago.
        g.MapPost("/payments", (HttpRequest request, PaymentService svc, IPaymentGatewayRegistry gateways, CancellationToken ct) =>
            HandlePaymentAsync(gateways.Default.Name, request, svc, ct));
        g.MapPost("/mercadopago", (HttpRequest request, PaymentService svc, CancellationToken ct) =>
            HandlePaymentAsync("mercadopago", request, svc, ct));

        g.MapPost("/shipping/{provider}", (string provider, HttpRequest request, TrackingService svc, CancellationToken ct) =>
            HandleShippingAsync(provider, request, svc, ct));
        g.MapPost("/shipping", (HttpRequest request, TrackingService svc, CancellationToken ct) =>
            HandleShippingAsync("generic", request, svc, ct));

        return api;
    }

    private static async Task<IResult> HandlePaymentAsync(string gateway, HttpRequest request, PaymentService svc, CancellationToken ct)
    {
        var webhook = await ReadWebhookAsync(request, ct);
        var handled = await svc.HandleWebhookAsync(gateway, webhook, ct);
        return handled ? Results.Ok(new { received = true }) : Results.Ok(new { received = true, ignored = true });
    }

    private static async Task<IResult> HandleShippingAsync(string provider, HttpRequest request, TrackingService svc, CancellationToken ct)
    {
        var webhook = await ReadWebhookAsync(request, ct);
        var (received, changed) = await svc.HandleWebhookAsync(provider, webhook, ct);
        return received ? Results.Ok(new { received = true, changed }) : Results.Ok(new { received = true, ignored = true });
    }

    private static async Task<WebhookRequest> ReadWebhookAsync(HttpRequest request, CancellationToken ct)
    {
        using var reader = new StreamReader(request.Body, Encoding.UTF8);
        var body = await reader.ReadToEndAsync(ct);
        var headers = request.Headers.ToDictionary(h => h.Key.ToLowerInvariant(), h => h.Value.ToString());
        var query = request.Query.ToDictionary(q => q.Key, q => q.Value.ToString());
        return new WebhookRequest(body, headers, query);
    }
}

/// <summary>Gera um PDF mínimo (texto monoespaçado) sem dependências — usado só pelo boleto de demonstração.</summary>
public static class SimplePdf
{
    public static byte[] Build(IReadOnlyList<string> lines)
    {
        var content = new StringBuilder("BT /F1 11 Tf 40 780 Td 16 TL\n");
        foreach (var line in lines)
            content.Append('(').Append(line.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)")).Append(") Tj T*\n");
        content.Append("ET");
        var stream = Encoding.Latin1.GetBytes(content.ToString());

        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            $"<< /Length {stream.Length} >>\nstream\n{Encoding.Latin1.GetString(stream)}\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
        };
        var sb = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var i = 0; i < objects.Count; i++)
        {
            offsets.Add(Encoding.Latin1.GetByteCount(sb.ToString()));
            sb.Append(i + 1).Append(" 0 obj\n").Append(objects[i]).Append("\nendobj\n");
        }
        var xref = Encoding.Latin1.GetByteCount(sb.ToString());
        sb.Append("xref\n0 ").Append(objects.Count + 1).Append('\n').Append("0000000000 65535 f \n");
        foreach (var o in offsets) sb.Append(o.ToString("D10")).Append(" 00000 n \n");
        sb.Append("trailer\n<< /Size ").Append(objects.Count + 1).Append(" /Root 1 0 R >>\nstartxref\n").Append(xref).Append("\n%%EOF");
        return Encoding.Latin1.GetBytes(sb.ToString());
    }
}
