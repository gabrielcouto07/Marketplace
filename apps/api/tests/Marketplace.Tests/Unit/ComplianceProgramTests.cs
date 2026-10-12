using Marketplace.Application.Common;
using Marketplace.Domain;
using Marketplace.Domain.Compliance;
using Marketplace.Domain.Entities;

namespace Marketplace.Tests.Unit;

/// <summary>Regras do Programa de Conformidade e da Política de Vendedores que não dependem de banco.</summary>
public class ComplianceProgramTests
{
    [Theory]
    [InlineData("22083020", "f")] // uísque
    [InlineData("22042100", "f")] // vinho
    [InlineData("22030000", "f")] // cerveja
    [InlineData("85434000", "d")] // cigarro eletrônico
    [InlineData("24041200", "e")] // nicotina para inalação
    [InlineData("71023900", "j")] // diamante
    [InlineData("49070010", "k")] // papel-moeda
    [InlineData("08051000", "l")] // fruta
    [InlineData("63090010", "i")] // vestuário usado
    [InlineData("93040010", "a")] // spray de pimenta (capítulo 93)
    [InlineData("96131000", "p")] // isqueiro
    public void AnnexI_BlocksProhibitedNcm(string ncm, string item)
    {
        var hit = ProhibitedGoods.CheckNcm(ncm);
        Assert.NotNull(hit);
        Assert.Equal(RestrictionLevel.Bloqueio, hit.Level);
        Assert.Equal(item, hit.AnnexItem);
        Assert.NotNull(Ncm.ProhibitionReason(ncm));
    }

    [Theory]
    [InlineData("22029900")] // bebida não alcoólica
    [InlineData("85171300")] // smartphone
    [InlineData("95045000")] // console
    [InlineData("33030010")] // perfume
    public void AnnexI_AllowsRegularGoods(string ncm) => Assert.Null(Ncm.ProhibitionReason(ncm));

    [Fact]
    public void AnnexI_RestrictedNcmGoesToReview()
    {
        var hit = ProhibitedGoods.CheckNcm("85076000"); // bateria de lítio avulsa
        Assert.Equal(RestrictionLevel.Analise, hit!.Level);
        Assert.Null(Ncm.ProhibitionReason("85076000"));
        Assert.Equal(16, ProhibitedGoods.Annex.Count);
    }

    [Theory]
    [InlineData("Whisky escocês 12 anos 1 L", null, "f")]
    [InlineData("Pod descartável sabor menta", null, "d")]
    [InlineData("Tênis seminovo tamanho 42", null, "i")]
    [InlineData("Bolsa de couro", "Réplica primeira linha, idêntica à original.", "o")]
    [InlineData("Pistola airsoft spring", null, "b")]
    public void AnnexI_TermsSendListingToReview(string title, string? body, string item)
    {
        var hit = ProhibitedGoods.CheckText(title, body);
        Assert.NotNull(hit);
        Assert.Equal(item, hit.AnnexItem);
    }

    [Theory]
    [InlineData("Taça para vinho de cristal", "Jogo com 6 taças.")] // "vinho" no título conta
    public void AnnexI_AmbiguousTitleTermStillReviewed(string title, string body) =>
        Assert.NotNull(ProhibitedGoods.CheckText(title, body));

    [Theory]
    [InlineData("Caneca térmica de aço", "Pode ser usado no carro e no escritório; cor vinho.")]
    [InlineData("Fone de ouvido Bluetooth", "Produto novo, lacrado e original.")]
    public void AnnexI_AmbiguousWordsInDescriptionDoNotFlag(string title, string body) =>
        Assert.Null(ProhibitedGoods.CheckText(title, body));

    [Theory]
    [InlineData("Acessórios", true)]
    [InlineData("Produto eletrônico", true)]
    [InlineData("Presente", true)]
    [InlineData("Kit de 3 itens diversos", true)]
    [InlineData("Fone de ouvido Bluetooth", false)]
    [InlineData("Capa protetora para telefone celular", false)]
    public void Declaration_RejectsGenericNature(string nature, bool generic) => Assert.Equal(generic, DeclarationText.IsGeneric(nature));

    [Fact]
    public void Declaration_HasNatureBrandModelMaterialAndQuantity()
    {
        var text = DeclarationText.Build("Fone de ouvido Bluetooth", "Acme", "X1", "plástico e espuma", 2, "Preto");
        Assert.Equal("Fone de ouvido Bluetooth, marca Acme, modelo X1, variação: Preto, material: plástico e espuma, quantidade: 2 un.", text);
        Assert.Contains("sem marca", DeclarationText.Build("Capa protetora", null, null, "TPU", 1));

        var product = new Product
        {
            Slug = "x", Name = "Capa", OriginCity = "Ciudad del Este", HsCode = "39269090", Nature = "Capa protetora para celular",
            Unbranded = true, Material = "TPU", PackageQuantity = 1, OriginCountry = "CN",
        };
        Assert.True(product.HasDeclarationData);
        product.OriginCountry = "XX";
        Assert.False(product.HasDeclarationData);
    }

    [Theory]
    [InlineData("MARIA APARECIDA DE SOUZA", "Maria Aparecida de Souza", true)]
    [InlineData("MARIA APARECIDA DE SOUZA", "Maria A. Souza", true)]
    [InlineData("MARIA APARECIDA DE SOUZA", "Maria Souza", true)]
    [InlineData("MARIA APARECIDA DE SOUZA", "Maria", false)]
    [InlineData("MARIA APARECIDA DE SOUZA", "Mariana Souza", false)]
    [InlineData("MARIA APARECIDA DE SOUZA", "Maria Aparecida Lima", false)]
    [InlineData("JOSÉ DA SILVA", "Jose da Silva", true)]
    public void CpfHolderName_Matches(string registry, string informed, bool expected) =>
        Assert.Equal(expected, PersonName.Matches(registry, informed));

    [Theory]
    [InlineData(new long[] { 3000, 3000 }, true)]   // US$ 30 + US$ 30: passa de US$ 50
    [InlineData(new long[] { 2000, 2000 }, false)]  // US$ 40 no total: mesma faixa
    [InlineData(new long[] { 6000, 7000 }, false)]  // as duas já acima de US$ 50
    [InlineData(new long[] { 200_000, 150_000 }, true)] // passa de US$ 3.000
    [InlineData(new long[] { 4000 }, false)]
    public void Fractioning_DetectsTierChange(long[] usdCents, bool expected) =>
        Assert.Equal(expected, Fractioning.IsIndication(usdCents));

    [Fact]
    public void Measures_AreGraduated()
    {
        Assert.Equal(SellerMeasureType.RemocaoAnuncio, MeasureGuide.Recommend(InfractionSeverity.Leve, 0, false, hasProduct: true).Type);
        Assert.Equal(SellerMeasureType.SuspensaoTemporaria, MeasureGuide.Recommend(InfractionSeverity.Media, 1, false, true).Type);
        Assert.Equal(SellerMeasureType.Exclusao, MeasureGuide.Recommend(InfractionSeverity.Grave, 1, false, true).Type);
        Assert.Equal(SellerMeasureType.Exclusao, MeasureGuide.Recommend(InfractionSeverity.Grave, 0, true, true).Type);
        Assert.Equal(SellerMeasureType.SuspensaoTemporaria, MeasureGuide.Recommend(InfractionSeverity.Grave, 0, false, true).Type);
    }

    [Fact]
    public void Deadlines_FollowTheProgram()
    {
        var friday = new DateTime(2026, 10, 9, 15, 0, 0, DateTimeKind.Utc);
        Assert.Equal(new DateTime(2026, 10, 13, 15, 0, 0, DateTimeKind.Utc), ProgramDeadlines.AddBusinessDays(friday, ProgramDeadlines.ReportDecisionBusinessDays));
        Assert.Equal(new DateTime(2026, 10, 16, 15, 0, 0, DateTimeKind.Utc), ProgramDeadlines.AddBusinessDays(friday, ProgramDeadlines.OmbudsmanBusinessDays));
        var (start, end) = ProgramDeadlines.AnnualManifestationWindow(2026);
        Assert.Equal(new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc), end);
        Assert.Equal(new DateTime(2031, 10, 9, 15, 0, 0, DateTimeKind.Utc), Application.Services.PrivacyService.RetentionEnds(friday));
    }

    [Fact]
    public void Bands_RequireActionPlanFromBronze()
    {
        Assert.False(ComplianceBands.RequiresActionPlan(ComplianceBand.Prata));
        Assert.True(ComplianceBands.RequiresActionPlan(ComplianceBand.Bronze));
        Assert.True(ComplianceBands.RequiresActionPlan(ComplianceBand.Advertencia));
        Assert.Contains("exclusão do PRC", ComplianceBands.Consequence(ComplianceBand.Exclusao));
    }

    [Fact]
    public void DocumentLinks_NormalizeKeysAndSignedLinks()
    {
        Assert.Equal("doc/2026/10/abc.pdf", DocumentLinks.Normalize("/api/documents/doc/2026/10/abc.pdf?t=xyz"));
        Assert.Equal("doc/2026/10/abc.pdf", DocumentLinks.Normalize("doc/2026/10/abc.pdf"));
        Assert.True(DocumentLinks.IsValidReference("/images/kyc/constancia-ruc.svg"));
        Assert.False(DocumentLinks.IsValidReference("doc/../../etc/passwd"));
        Assert.False(DocumentLinks.IsValidReference("javascript:alert(1)"));
    }

    [Fact]
    public void TextPdf_PaginatesLongReceipts()
    {
        var pdf = new TextPdf().Title("Comprovante");
        for (var i = 0; i < 200; i++) pdf.Text($"Linha {i} com acentuação: ação, pão, Ñandutí");
        var bytes = pdf.Build();
        var text = System.Text.Encoding.Latin1.GetString(bytes);
        Assert.StartsWith("%PDF-1.4", text);
        Assert.True(text.Split("/Type /Page ").Length - 1 >= 3);
    }
}
