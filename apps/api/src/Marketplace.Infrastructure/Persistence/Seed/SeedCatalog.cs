using System.Reflection;
using System.Text.Json;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using static Marketplace.Domain.Common.DeterministicId;

namespace Marketplace.Infrastructure.Persistence.Seed;

/// <summary>
/// Port das fixtures do front (apps/web/src/mocks/fixtures): mesmas categorias, lojas, 64 produtos e IDs
/// determinísticos. Datas relativas a uma data-base fixa (25/09/2026), como no mock.
/// </summary>
public static class SeedCatalog
{
    public static readonly DateTime BaseDate = new(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc);

    public static DateTime DaysAgo(int days, int hour = 10) => BaseDate.AddHours(hour).AddDays(-days);

    public sealed record CategorySeed(string Slug, string Name, string IconKey);

    public static readonly CategorySeed[] Categories =
    [
        new("eletronicos", "Eletrônicos", "tv"),
        new("perfumes", "Perfumes", "spray-can"),
        new("informatica", "Informática", "laptop"),
        new("celulares", "Celulares", "smartphone"),
        new("bebidas", "Bebidas", "wine"),
        new("casa", "Casa", "sofa"),
        new("esportes", "Esportes", "dumbbell"),
        new("moda", "Moda", "shirt"),
    ];

    public sealed record SellerSeed(
        string Slug, string Name, string City, int ReputationLevel, bool IsOfficialStore, string Ruc, int MemberSinceDays,
        string[] Categories, string Description, int SalesCount, int Positive, int OnTime, int Response, double Rating, int ReviewCount);

    public static readonly SellerSeed[] Sellers =
    [
        new("tecnocentro-cde", "TecnoCentro CDE", "Ciudad del Este", 5, true, "80012345-0", 1460, ["eletronicos", "informatica", "celulares"],
            "Loja de eletrônicos no centro de Ciudad del Este com mais de 10 anos de experiência. Produtos lacrados, nota fiscal e garantia com assistência no Brasil.",
            18420, 98, 97, 2, 4.8, 6210),
        new("perfumaria-del-este", "Perfumaria del Este", "Ciudad del Este", 5, true, "80023456-1", 1100, ["perfumes"],
            "Importadora oficial de fragrâncias. Todos os perfumes são originais, lacrados e com lote verificável.",
            9310, 99, 96, 1, 4.9, 3120),
        new("casa-nova-import", "Casa Nova Import", "Ciudad del Este", 4, false, "80034567-3", 720, ["casa"],
            "Eletroportáteis e utilidades para o lar com voltagem bivolt e manual em português.",
            4120, 95, 93, 4, 4.6, 1210),
        new("megastore-paraguay", "MegaStore Paraguay", "Asunción", 4, false, "80045678-5", 900, ["eletronicos", "informatica", "celulares", "casa"],
            "Variedade em tecnologia e casa com envio de Assunção. Estoque próprio e atendimento em português.",
            7780, 94, 92, 5, 4.5, 2440),
        new("nippon-center", "Nippon Center", "Ciudad del Este", 5, true, "80056789-7", 2000, ["celulares", "eletronicos"],
            "Especialista em smartphones e acessórios. Aparelhos com garantia estendida e suporte pós-venda.",
            22150, 97, 98, 1, 4.8, 8020),
        new("bebidas-del-puente", "Bebidas del Puente", "Ciudad del Este", 3, false, "80067890-7", 400, ["bebidas"],
            "Destilados, vinhos e espumantes importados. Embalagem reforçada para transporte internacional.",
            1560, 90, 88, 8, 4.2, 430),
        new("sport-house-py", "Sport House PY", "Salto del Guairá", 4, false, "80078901-6", 610, ["esportes"],
            "Equipamentos de esporte e outdoor. Envio de Salto del Guairá com rastreio completo.",
            2980, 96, 94, 3, 4.7, 890),
        new("moda-guarani", "Moda Guaraní", "Pedro Juan Caballero", 3, false, "80089012-4", 250, ["moda"],
            "Acessórios, calçados e vestuário com curadoria. Troca garantida em até 30 dias.",
            870, 91, 90, 6, 4.3, 260),
    ];

    private const string ExchangePolicy =
        "Trocas e devoluções em até 30 dias após o recebimento para produtos lacrados ou com defeito de fabricação. O frete de devolução é por conta da loja em caso de defeito.";

    private static readonly string[] ReviewAuthors =
    [
        "Mariana S.", "Carlos E.", "Juliana P.", "Rafael M.", "Fernanda L.", "Bruno A.",
        "Patrícia R.", "Lucas T.", "Camila F.", "Diego N.", "Aline C.", "Thiago V.",
    ];

    private static readonly (int Rating, string Title, string Comment)[] ReviewTexts =
    [
        (5, "Chegou antes do prazo", "Produto original, lacrado e chegou 5 dias antes da estimativa. Recomendo a loja."),
        (5, "Excelente custo-benefício", "Mesmo com o imposto ficou bem mais barato do que no Brasil. Embalagem impecável."),
        (4, "Muito bom", "Produto conforme o anúncio. Só o rastreio demorou alguns dias para atualizar na alfândega."),
        (4, "Gostei", "Funciona perfeitamente. A caixa veio um pouco amassada, mas o produto estava intacto."),
        (3, "Ok, mas demorou", "Chegou dentro da faixa de prazo, mas no limite. Produto bom."),
        (5, "Perfeito", "Segunda compra com esse vendedor, sempre entrega certinho e responde rápido."),
        (2, "Veio com defeito", "Veio com um problema, mas a loja resolveu a troca sem burocracia. Por isso não dou 1."),
        (5, "Recomendo", "Atendimento excelente, tiraram todas as dúvidas antes da compra."),
    ];

    private static readonly (string Q, string? A)[] QuestionTexts =
    [
        ("Vem com nota fiscal e garantia no Brasil?", "Olá! Enviamos com invoice e a garantia é de fábrica, atendida por assistência credenciada no Brasil."),
        ("Qual o prazo real de entrega para São Paulo?", "Em média 12 a 18 dias úteis, já contando o desembaraço."),
        ("O imposto já está incluso no preço?", "O imposto de importação é estimado no checkout e exibido separadamente antes de você pagar."),
        ("Aceita parcelamento no cartão?", "Sim, em até 12x com juros da operadora ou à vista no Pix com desconto."),
        ("Tem estoque disponível para envio imediato?", null),
        ("É bivolt?", "Sim, 110/220 V automático."),
    ];

    private sealed record Template(string Name, long Price, long? CompareAt, List<string[]> Attrs, Dictionary<string, List<string>>? Variants, int? Warranty);

    private static Dictionary<string, List<Template>> LoadTemplates()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("product-templates.json")
                           ?? throw new InvalidOperationException("product-templates.json não embutido.");
        return JsonSerializer.Deserialize<Dictionary<string, List<Template>>>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web))
               ?? throw new InvalidOperationException("product-templates.json inválido.");
    }

    public sealed record Catalog(List<Category> Categories, List<Seller> Sellers, List<Product> Products, List<Review> Reviews, List<Question> Questions);

    public static Catalog Build()
    {
        var categories = Categories.Select((c, i) => new Category
        {
            Id = Guid($"category:{c.Slug}"),
            Slug = c.Slug,
            Name = c.Name,
            IconKey = c.IconKey,
            ImageUrl = $"/images/categories/{c.Slug}.webp",
            SortOrder = i,
        }).ToList();
        var categoryBySlug = categories.ToDictionary(c => c.Slug);

        var sellers = Sellers.Select(s => new Seller
        {
            Id = Guid($"seller:{s.Slug}"),
            Slug = s.Slug,
            Name = s.Name,
            LogoUrl = $"/images/sellers/{s.Slug}.svg",
            BannerUrl = $"/images/banners/seller-{s.Slug}.webp",
            ReputationLevel = s.ReputationLevel,
            IsOfficialStore = s.IsOfficialStore,
            City = s.City,
            Description = s.Description,
            Ruc = s.Ruc,
            MemberSince = DaysAgo(s.MemberSinceDays),
            ExchangePolicy = ExchangePolicy,
            SalesCount = s.SalesCount,
            PositiveRatingPercent = s.Positive,
            OnTimeShippingPercent = s.OnTime,
            AvgResponseTimeHours = s.Response,
            Rating = s.Rating,
            ReviewCount = s.ReviewCount,
            Categories = s.Categories.Select(slug => new SellerCategory { CategoryId = categoryBySlug[slug].Id }).ToList(),
        }).ToList();
        var sellerCategorySlugs = Sellers.ToDictionary(s => s.Slug, s => s.Categories);

        var templates = LoadTemplates();
        var products = new List<Product>();
        var reviews = new List<Review>();
        var questions = new List<Question>();
        var global = 0;

        foreach (var category in categories)
        {
            var list = templates.GetValueOrDefault(category.Slug) ?? [];
            for (var i = 0; i < list.Count; i++)
            {
                var t = list[i];
                global++;
                var seller = PickSeller(sellers, sellerCategorySlugs, category.Slug, i + global);
                var key = $"product:{category.Slug}:{i + 1}";
                var rnd = Seeded(HashString(key));
                var slug = $"{Slug.From(t.Name)}-{category.Slug[..3]}{i + 1}";
                var options = t.Variants?.Select(kv => new VariantOption(kv.Key, kv.Value)).ToList() ?? [];
                var variants = BuildVariants(key, category.Slug, i + 1, t.Price, t.CompareAt, options, rnd);
                var stock = variants.Count > 0
                    ? variants.Sum(v => v.Stock)
                    : rnd() < 0.08 ? 0 : 3 + (int)Math.Floor(rnd() * 40);
                var productId = Guid(key);
                var (productReviews, average, total) = BuildReviews(key, productId, seller.Id, rnd);
                var productQuestions = BuildQuestions(key, productId, rnd);
                var createdDaysAgo = (int)Math.Floor(rnd() * 200);
                var reviewCount = total + (int)Math.Floor(rnd() * 300);
                var soldCount = (int)Math.Floor(rnd() * 2500);
                var freeShipping = t.Price >= 30000 && rnd() > 0.35;

                var images = new[] { 1, 2, 3 }.Select(n => new ProductImage
                {
                    Id = Guid($"{key}:image:{n}"),
                    ProductId = productId,
                    Url = $"/images/products/{category.Slug}-{i + 1}-{n}.webp",
                    Alt = $"{t.Name} — imagem {n}",
                    SortOrder = n,
                }).ToList();

                products.Add(new Product
                {
                    Id = productId,
                    SellerId = seller.Id,
                    CategoryId = category.Id,
                    Slug = slug,
                    Name = t.Name,
                    SearchText = Slug.Normalize($"{t.Name} {seller.Name}"),
                    Description = BuildDescription(t.Name, category.Name, t.Attrs, seller.City),
                    PriceAmount = t.Price,
                    CompareAtAmount = t.CompareAt,
                    Stock = stock,
                    FreeShipping = freeShipping,
                    SoldCount = soldCount,
                    Rating = average,
                    ReviewCount = reviewCount,
                    OriginCity = seller.City,
                    HandlingDaysMin = 1,
                    HandlingDaysMax = 3,
                    WarrantyMonths = t.Warranty,
                    Status = ProductStatus.Ativo,
                    CreatedAt = DaysAgo(createdDaysAgo),
                    UpdatedAt = DaysAgo(createdDaysAgo),
                    VariantOptions = options,
                    Attributes = t.Attrs.Select(a => new ProductAttribute(a[0], a[1])).ToList(),
                    Images = images,
                    Variants = variants,
                });
                reviews.AddRange(productReviews);
                questions.AddRange(productQuestions);
            }
        }

        return new Catalog(categories, sellers, products, reviews, questions);
    }

    private static Seller PickSeller(List<Seller> sellers, Dictionary<string, string[]> categoriesBySeller, string categorySlug, int index)
    {
        var eligible = sellers.Where(s => categoriesBySeller[s.Slug].Contains(categorySlug)).ToList();
        var pool = eligible.Count > 0 ? eligible : sellers;
        return pool[index % pool.Count];
    }

    private static List<Dictionary<string, string>> Cartesian(List<VariantOption> options)
    {
        var acc = new List<Dictionary<string, string>> { new() };
        foreach (var opt in options)
        {
            acc = acc.SelectMany(combo => opt.Values.Select(v =>
            {
                var next = new Dictionary<string, string>(combo) { [opt.Name] = v };
                return next;
            })).ToList();
        }
        return acc;
    }

    private static List<ProductVariant> BuildVariants(string key, string categorySlug, int index, long basePrice, long? compareAt, List<VariantOption> options, Func<double> rnd)
    {
        if (options.Count == 0) return [];
        var combos = Cartesian(options);
        var first = options[0];
        var skuPrefix = $"{categorySlug[..3].ToUpperInvariant()}{index:00}";
        return combos.Select((attributes, i) =>
        {
            var idx = first.Values.IndexOf(attributes[first.Name]);
            var bump = first.Name is "Cor" or "Sabor" or "Fragrância" ? 0 : idx * 18;
            var price = Money.RoundDiv(basePrice * (100 + bump), 100);
            long? cmp = compareAt is { } c ? Money.RoundDiv(c * (100 + bump), 100) : null;
            var stock = rnd() < 0.12 ? 0 : 1 + (int)Math.Floor(rnd() * 25);
            return new ProductVariant
            {
                Id = Guid($"{key}:variant:{i}"),
                ProductId = Guid(key),
                Sku = $"{skuPrefix}-{i + 1:00}",
                Attributes = attributes,
                PriceAmount = price,
                CompareAtAmount = cmp,
                Stock = stock,
            };
        }).ToList();
    }

    private static string BuildDescription(string name, string categoryName, List<string[]> attrs, string sellerCity)
    {
        var specs = string.Join("\n", attrs.Select(a => $"• {a[0]}: {a[1]}"));
        return $"{name} — produto novo, lacrado e original, enviado diretamente de {sellerCity} (Paraguai).\n\n" +
               $"Categoria: {categoryName}.\n\n" +
               $"Principais características:\n{specs}\n\n" +
               "O envio internacional é feito com rastreio ponta a ponta. Os prazos exibidos consideram dias úteis e o desembaraço aduaneiro. " +
               "Os impostos de importação são estimados no checkout e podem variar conforme a fiscalização.";
    }

    private static (List<Review> Reviews, double Average, int Total) BuildReviews(string key, Guid productId, Guid sellerId, Func<double> rnd)
    {
        var count = 3 + (int)Math.Floor(rnd() * 4);
        var reviews = new List<Review>();
        for (var i = 0; i < count; i++)
        {
            var text = ReviewTexts[(int)Math.Floor(rnd() * ReviewTexts.Length)];
            var author = ReviewAuthors[(int)Math.Floor(rnd() * ReviewAuthors.Length)];
            var createdAt = DaysAgo(2 + (int)Math.Floor(rnd() * 120));
            var helpful = (int)Math.Floor(rnd() * 40);
            var verified = rnd() > 0.15;
            reviews.Add(new Review
            {
                Id = Guid($"{key}:review:{i}"),
                ProductId = productId,
                SellerId = sellerId,
                AuthorName = author,
                Rating = text.Rating,
                Title = text.Title,
                Comment = text.Comment,
                CreatedAt = createdAt,
                HelpfulCount = helpful,
                VerifiedPurchase = verified,
            });
        }
        var average = reviews.Count == 0 ? 0 : Math.Round(reviews.Average(r => r.Rating) * 10) / 10;
        return (reviews, average, reviews.Count);
    }

    private static List<Question> BuildQuestions(string key, Guid productId, Func<double> rnd)
    {
        var count = 1 + (int)Math.Floor(rnd() * 4);
        var hash = HashString(key);
        var list = new List<Question>();
        for (var i = 0; i < count; i++)
        {
            var q = QuestionTexts[(int)((hash + (uint)i) % (uint)QuestionTexts.Length)];
            var askedAt = DaysAgo(1 + (int)Math.Floor(rnd() * 60));
            list.Add(new Question
            {
                Id = Guid($"{key}:question:{i}"),
                ProductId = productId,
                AskedByName = ReviewAuthors[(int)(((uint)(i * 5) + hash) % (uint)ReviewAuthors.Length)],
                Text = q.Q,
                AskedAt = askedAt,
                AnswerText = q.A,
                AnsweredAt = q.A is null ? null : askedAt,
            });
        }
        return list;
    }

    public static List<ExchangeRate> ExchangeRates(DateTime now) =>
    [
        new() { Id = Guid("rate:BRL:PYG"), From = CurrencyCode.BRL, To = CurrencyCode.PYG, Numerator = 1389, Denominator = 100, DisplayRate = "R$ 1,00 = ₲ 1.389", QuotedAt = now, ExpiresAt = now.AddYears(1), Source = "seed" },
        new() { Id = Guid("rate:PYG:BRL"), From = CurrencyCode.PYG, To = CurrencyCode.BRL, Numerator = 72, Denominator = 1000, DisplayRate = "₲ 1.000 = R$ 0,72", QuotedAt = now, ExpiresAt = now.AddYears(1), Source = "seed" },
        new() { Id = Guid("rate:USD:BRL"), From = CurrencyCode.USD, To = CurrencyCode.BRL, Numerator = 540, Denominator = 100, DisplayRate = "US$ 1,00 = R$ 5,40", QuotedAt = now, ExpiresAt = now.AddYears(1), Source = "seed" },
    ];

    /// <summary>Zoneamento por primeiro dígito do CEP (mesma tabela do mock).</summary>
    public static List<ShippingZone> ShippingZones() =>
    [
        new() { Prefix = "0", State = "SP", City = "São Paulo", SurchargeAmount = 0, ExtraDays = 0 },
        new() { Prefix = "1", State = "SP", City = "Campinas", SurchargeAmount = 300, ExtraDays = 1 },
        new() { Prefix = "2", State = "RJ", City = "Rio de Janeiro", SurchargeAmount = 600, ExtraDays = 1 },
        new() { Prefix = "3", State = "MG", City = "Belo Horizonte", SurchargeAmount = 700, ExtraDays = 1 },
        new() { Prefix = "4", State = "BA", City = "Salvador", SurchargeAmount = 1500, ExtraDays = 3 },
        new() { Prefix = "5", State = "PE", City = "Recife", SurchargeAmount = 1800, ExtraDays = 4 },
        new() { Prefix = "6", State = "CE", City = "Fortaleza", SurchargeAmount = 2000, ExtraDays = 5 },
        new() { Prefix = "7", State = "DF", City = "Brasília", SurchargeAmount = 1100, ExtraDays = 2 },
        new() { Prefix = "8", State = "PR", City = "Curitiba", SurchargeAmount = -400, ExtraDays = -2 },
        new() { Prefix = "9", State = "RS", City = "Porto Alegre", SurchargeAmount = 200, ExtraDays = 0 },
    ];

    public static List<Banner> Banners() =>
    [
        new() { Id = Guid("banner:1"), Title = "Semana da Tecnologia", Subtitle = "Até 40% off em smartphones e notebooks", ImageUrl = "/images/banners/tech.webp", Href = "/busca?onlyOffers=true&categorySlug=celulares", Tone = BannerTone.blue, SortOrder = 1 },
        new() { Id = Guid("banner:2"), Title = "Perfumes originais", Subtitle = "Importadora oficial com lote verificável", ImageUrl = "/images/banners/perfumes.webp", Href = "/categoria/perfumes", Tone = BannerTone.red, SortOrder = 2 },
        new() { Id = Guid("banner:3"), Title = "Frete grátis acima de R$ 300", Subtitle = "Nas lojas participantes, com rastreio ponta a ponta", ImageUrl = "/images/banners/frete.webp", Href = "/busca?freeShipping=true", Tone = BannerTone.neutral, SortOrder = 3 },
    ];
}
