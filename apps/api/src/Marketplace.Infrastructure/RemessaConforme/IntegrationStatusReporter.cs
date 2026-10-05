using Marketplace.Application.Abstractions;
using Marketplace.Application.Contracts;
using Marketplace.Domain.Common;
using Marketplace.Infrastructure.Gov;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.RemessaConforme;

/// <summary>Painel "Integrações" do admin: o que está ligado, o que está em sandbox e qual variável de ambiente falta.</summary>
public sealed class IntegrationStatusReporter(
    IOptions<RemessaConformeOptions> remessa,
    IOptions<SiscomexOptions> siscomex,
    IOptions<SerproOptions> serpro,
    IOptions<NcmOptions> ncm,
    IOptions<PtaxOptions> ptax,
    IRemessaCarrierGateway carrier,
    SiscomexNcmCatalog ncmCatalog) : IIntegrationStatusReporter
{
    private const string Docs = "docs/REMESSA_CONFORME.md";
    private static readonly System.Globalization.CultureInfo PtBr = System.Globalization.CultureInfo.GetCultureInfo("pt-BR");

    public Task<IReadOnlyList<IntegrationStatusDto>> GetAsync(CancellationToken ct)
    {
        var list = new List<IntegrationStatusDto>();

        var p = remessa.Value.Platform;
        var platformMissing = new List<string>();
        if (string.IsNullOrWhiteSpace(p.LegalName)) platformMissing.Add("RemessaConforme__Platform__LegalName");
        if (string.IsNullOrWhiteSpace(p.Document)) platformMissing.Add("RemessaConforme__Platform__Document");
        if (string.IsNullOrWhiteSpace(p.AdeNumber)) platformMissing.Add("RemessaConforme__Platform__AdeNumber");
        list.Add(new IntegrationStatusDto("platform", "Identidade da empresa (ECE)",
            "Marca, nome comercial e CNPJ/TIN na etiqueta e no bloco remessaConforme da DIR (critério iii).",
            p.DocumentType, platformMissing.Count == 0, true, platformMissing.Count == 0 ? "Configurado" : "Incompleto", platformMissing,
            $"{p.Brand} · {p.TradeName}{(string.IsNullOrWhiteSpace(p.Document) ? "" : $" · {p.DocumentType} {p.Document}")}", Docs));

        var c = remessa.Value.Carrier;
        var carrierMissing = new List<string>();
        if (carrier.IsSandbox || !carrier.IsConfigured)
        {
            if (string.IsNullOrWhiteSpace(c.BaseUrl)) carrierMissing.Add("RemessaConforme__Carrier__BaseUrl");
            if (string.IsNullOrWhiteSpace(c.ApiKey)) carrierMissing.Add("RemessaConforme__Carrier__ApiKey");
            if (!c.Provider.Equals("Http", StringComparison.OrdinalIgnoreCase)) carrierMissing.Add("RemessaConforme__Carrier__Provider=Http");
        }
        list.Add(new IntegrationStatusDto("carrier", "Operador logístico (Correios/courier)",
            "Recebe os dados da declaração antecipada, devolve a etiqueta e recebe o repasse dos tributos (critério i).",
            carrier.Name, carrier.IsConfigured && !carrier.IsSandbox, true,
            carrier.IsSandbox ? "Sandbox" : carrier.IsConfigured ? "Produção" : "Desligado", carrierMissing,
            carrier.IsSandbox ? "Etiquetas de teste, marcadas \"SANDBOX · NÃO POSTAR\"." : c.BaseUrl, Docs));

        var s = siscomex.Value;
        var sisMissing = new List<string>();
        if (string.IsNullOrWhiteSpace(s.ClientId)) sisMissing.Add("Siscomex__ClientId");
        if (string.IsNullOrWhiteSpace(s.ClientSecret)) sisMissing.Add("Siscomex__ClientSecret");
        if (Documents.OnlyDigits(s.Cnpj).Length != 14) sisMissing.Add("Siscomex__Cnpj");
        var sisOn = sisMissing.Count == 0;
        list.Add(new IntegrationStatusDto("siscomex", "Portal Único Siscomex — Remessas Internacionais",
            "Consulta de remessas da ECE (perfil EMPRCOMEL): DIR, situação, ocorrências e divergências que alimentam os indicadores.",
            "portal-unico", sisOn, true, sisOn ? (s.BaseUrl.Contains("val.", StringComparison.OrdinalIgnoreCase) ? "Validação" : "Produção") : "Desligado",
            sisMissing,
            SiscomexSyncJob.LastSuccessAt is { } at ? $"Última sincronização {at:dd/MM HH:mm} UTC: {SiscomexSyncJob.LastResult}" : s.BaseUrl, Docs));

        var sp = serpro.Value;
        var serproMissing = new List<string>();
        if (string.IsNullOrWhiteSpace(sp.ConsumerKey)) serproMissing.Add("Serpro__ConsumerKey");
        if (string.IsNullOrWhiteSpace(sp.ConsumerSecret)) serproMissing.Add("Serpro__ConsumerSecret");
        list.Add(new IntegrationStatusDto("serpro", "Serpro — Consulta CPF",
            "Situação do CPF do destinatário na Receita antes da compra (indicador de qualidade da declaração).",
            "serpro", serproMissing.Count == 0, true, serproMissing.Count == 0 ? "Produção" : "Só dígito verificador", serproMissing,
            null, Docs));

        var n = ncm.Value;
        var offline = n.Source.Equals("Offline", StringComparison.OrdinalIgnoreCase);
        list.Add(new IntegrationStatusDto("ncm", "Tabela NCM oficial (Siscomex)",
            "Confere se o NCM de cada produto existe na nomenclatura vigente. Pública, sem chave.",
            "siscomex-classif", ncmCatalog.IsLoaded, false, offline ? "Desligado" : ncmCatalog.IsLoaded ? "Ativo" : "Carregando", [],
            ncmCatalog.IsLoaded ? $"{ncmCatalog.Count.ToString("N0", PtBr)} códigos · {ncmCatalog.Version}" : offline ? "Ncm__Source=Offline: só o formato é conferido." : "Baixando a tabela.", Docs));

        var pt = ptax.Value;
        var ptaxOn = pt.Provider.Equals(BcbPtaxClient.ProviderName, StringComparison.OrdinalIgnoreCase);
        list.Add(new IntegrationStatusDto("ptax", "Banco Central — PTAX",
            "Câmbio oficial USD→BRL para a faixa de US$ 50 e o valor em dólar da declaração. Pública, sem chave.",
            "bcb-ptax", ptaxOn && PtaxRefreshJob.LastSuccessAt is not null, false, ptaxOn ? "Ativo" : "Desligado", [],
            PtaxRefreshJob.LastRate ?? (ptaxOn ? "Aguardando a primeira consulta." : "Câmbio cadastrado pelo admin."), Docs));

        return Task.FromResult<IReadOnlyList<IntegrationStatusDto>>(list);
    }
}
