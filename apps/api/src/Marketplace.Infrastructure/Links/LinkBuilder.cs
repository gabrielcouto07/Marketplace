using Marketplace.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Links;

public sealed class LinkOptions
{
    /// <summary>URL pública do PWA (Next.js), sem barra final.</summary>
    public string SiteUrl { get; set; } = "http://localhost:3210";
    /// <summary>URL pública desta API incluindo o prefixo, ex.: https://api.exemplo.com/api.</summary>
    public string ApiUrl { get; set; } = "http://localhost:5210/api";
    public string TrackingUrlTemplate { get; set; } = "{site}/conta/pedidos?rastreio={code}";
    public string PrivacyPolicyPath { get; set; } = "/privacidade";
    public string TermsPath { get; set; } = "/termos";
}

public sealed class LinkBuilder(IOptions<LinkOptions> options) : ILinkBuilder
{
    public string SiteUrl => options.Value.SiteUrl.TrimEnd('/');
    public string ApiUrl => options.Value.ApiUrl.TrimEnd('/');
    public string Product(string slug) => $"{SiteUrl}/produto/{slug}";
    public string Seller(string slug) => $"{SiteUrl}/loja/{slug}";
    public string Order(Guid orderId) => $"{SiteUrl}/conta/pedidos/{orderId}";
    public string PaymentPage(Guid paymentId) => $"{SiteUrl}/pagamento/{paymentId}";
    public string BoletoPdf(Guid paymentId) => $"{ApiUrl}/payments/{paymentId}/boleto.pdf";
    public string PasswordReset(string token) => $"{SiteUrl}/redefinir-senha?token={Uri.EscapeDataString(token)}";
    public string Tracking(string trackingCode) =>
        options.Value.TrackingUrlTemplate.Replace("{site}", SiteUrl).Replace("{code}", Uri.EscapeDataString(trackingCode));
    public string PrivacyPolicy() => $"{SiteUrl}{options.Value.PrivacyPolicyPath}";
    public string Terms() => $"{SiteUrl}{options.Value.TermsPath}";
}
