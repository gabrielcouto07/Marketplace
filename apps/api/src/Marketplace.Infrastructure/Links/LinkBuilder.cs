using System.Text.RegularExpressions;
using Marketplace.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Links;

public sealed class LinkOptions
{
    /// <summary>URL pública do PWA (Next.js), sem barra final.</summary>
    public string SiteUrl { get; set; } = "http://localhost:3210";
    /// <summary>URL pública desta API incluindo o prefixo, ex.: https://api.exemplo.com/api.</summary>
    public string ApiUrl { get; set; } = "http://localhost:5210/api";
    /// <summary>
    /// Página de rastreio por transportadora (chave = trecho do nome informado no envio, case-insensitive;
    /// valor = template com {code}). Códigos no padrão postal universal (AA123456789BR) caem nos Correios.
    /// </summary>
    public Dictionary<string, string> TrackingUrlTemplates { get; set; } = new(StringComparer.OrdinalIgnoreCase)
    {
        ["correios"] = "https://rastreamento.correios.com.br/app/index.php?objetos={code}",
    };
    /// <summary>Template usado quando nenhuma transportadora casa (vazio = sem link).</summary>
    public string DefaultTrackingUrlTemplate { get; set; } = string.Empty;
    public string PrivacyPolicyPath { get; set; } = "/privacidade";
    public string TermsPath { get; set; } = "/termos";
    /// <summary>Validade do link assinado do PDF do boleto (precisa cobrir o vencimento).</summary>
    public int BoletoLinkDays { get; set; } = 10;
}

public sealed partial class LinkBuilder(IOptions<LinkOptions> options, IDownloadTokenService tokens) : ILinkBuilder
{
    public string SiteUrl => options.Value.SiteUrl.TrimEnd('/');
    public string ApiUrl => options.Value.ApiUrl.TrimEnd('/');
    public string Product(string slug) => $"{SiteUrl}/produto/{slug}";
    public string Seller(string slug) => $"{SiteUrl}/loja/{slug}";
    public string Order(Guid orderId) => $"{SiteUrl}/conta/pedidos/{orderId}";
    public string PaymentPage(Guid paymentId) => $"{SiteUrl}/pagamento/{paymentId}";

    /// <summary>Link assinado: o PDF abre sem sessão (download em nova aba) e expira junto com o boleto.</summary>
    public string BoletoPdf(Guid paymentId)
    {
        var token = tokens.Issue(DownloadTokenPurposes.Boleto, paymentId.ToString(), TimeSpan.FromDays(Math.Max(1, options.Value.BoletoLinkDays)));
        return $"{ApiUrl}/payments/{paymentId}/boleto.pdf?t={Uri.EscapeDataString(token)}";
    }

    public string PasswordReset(string token) => $"{SiteUrl}/redefinir-senha?token={Uri.EscapeDataString(token)}";

    public string? Tracking(string trackingCode, string? carrier)
    {
        var code = Uri.EscapeDataString(trackingCode);
        if (!string.IsNullOrWhiteSpace(carrier))
        {
            foreach (var (key, template) in options.Value.TrackingUrlTemplates)
                if (carrier.Contains(key, StringComparison.OrdinalIgnoreCase)) return template.Replace("{code}", code);
        }
        if (UniversalPostalCode().IsMatch(trackingCode) && options.Value.TrackingUrlTemplates.TryGetValue("correios", out var correios))
            return correios.Replace("{code}", code);
        var fallback = options.Value.DefaultTrackingUrlTemplate;
        return string.IsNullOrWhiteSpace(fallback) ? null : fallback.Replace("{site}", SiteUrl).Replace("{code}", code);
    }

    public string PrivacyPolicy() => $"{SiteUrl}{options.Value.PrivacyPolicyPath}";
    public string Terms() => $"{SiteUrl}{options.Value.TermsPath}";

    [GeneratedRegex(@"^[A-Z]{2}\d{9}[A-Z]{2}$")]
    private static partial Regex UniversalPostalCode();
}
