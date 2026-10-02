using Marketplace.Application.Abstractions;
using Marketplace.Application.Services;
using Marketplace.Infrastructure.Auth;
using Marketplace.Infrastructure.Background;
using Marketplace.Infrastructure.Email;
using Marketplace.Infrastructure.ExchangeRates;
using Marketplace.Infrastructure.Links;
using Marketplace.Infrastructure.Payments;
using Marketplace.Infrastructure.Persistence;
using Marketplace.Infrastructure.Providers;
using Marketplace.Infrastructure.Security;
using Marketplace.Infrastructure.Shipping;
using Marketplace.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Marketplace.Infrastructure;

/// <summary>
/// Composição das integrações. Cada tipo (pagamento, frete, rastreio, câmbio, storage, e-mail) tem uma porta na
/// camada Application e um catálogo de provedores aqui; a configuração escolhe qual está ativo:
/// <c>Payments:Provider</c>, <c>Shipping:Provider</c>, <c>Tracking:Provider</c>, <c>ExchangeRates:Provider</c>,
/// <c>Storage:Provider</c>, <c>Email:Provider</c>. Para adicionar uma transportadora ou gateway: implemente a porta e
/// registre com <c>AddProvider&lt;TPorta, TImpl&gt;("nome")</c>.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config, IHostEnvironment env)
    {
        services.Configure<DatabaseOptions>(o =>
        {
            // Recriar o SQLite quando o schema muda é conveniência de dev; em qualquer outro ambiente é perda de dados.
            o.RecreateSqliteOnSchemaChange = env.IsDevelopment();
            config.GetSection("Database").Bind(o);
            var postgres = config.GetConnectionString("Postgres");
            if (!string.IsNullOrWhiteSpace(postgres))
            {
                o.Provider = "Postgres";
                o.PostgresConnectionString = postgres;
            }
            else if (!env.IsDevelopment() && !o.AllowSqliteOutsideDevelopment)
                throw new InvalidOperationException(
                    "ConnectionStrings:Postgres (ou ConnectionStrings__Postgres) é obrigatório fora de Development. " +
                    "Para homologação descartável em SQLite, ligue Database:AllowSqliteOutsideDevelopment=true.");
        });
        services.Configure<AdminOptions>(config.GetSection("Admin"));
        services.Configure<JwtOptions>(config.GetSection("Auth:Jwt"));
        services.Configure<AuthOptions>(config.GetSection("Auth"));
        services.Configure<GoogleOptions>(config.GetSection("Auth:Google"));
        services.Configure<PrivacyOptions>(config.GetSection("Privacy"));
        services.Configure<LinkOptions>(config.GetSection("Links"));
        services.Configure<FakePaymentOptions>(config.GetSection("Payments:Fake"));
        services.Configure<PostalCodeOptions>(config.GetSection("PostalCodes"));
        services.Configure<TrackingOptions>(config.GetSection("Tracking"));
        services.Configure<ShippingOptions>(config.GetSection("Shipping"));
        services.Configure<ExchangeRateOptions>(config.GetSection("ExchangeRates"));
        services.Configure<HousekeepingOptions>(config.GetSection("Housekeeping"));
        services.Configure<StorageOptions>(config.GetSection("Storage"));
        services.Configure<EmailOptions>(config.GetSection("Email"));

        var paymentProvider = config["Payments:Provider"] ?? FakePaymentGateway.GatewayName;
        var isMercadoPago = paymentProvider.Equals(MercadoPagoGateway.GatewayName, StringComparison.OrdinalIgnoreCase);
        var isFake = paymentProvider.Equals(FakePaymentGateway.GatewayName, StringComparison.OrdinalIgnoreCase);
        services.AddOptions<PaymentOptions>()
            .Bind(config.GetSection("Payments"))
            .Validate(o => env.IsDevelopment() || !isFake || o.AllowFakeOutsideDevelopment,
                "Payments:Provider=Fake fora de Development exige Payments:AllowFakeOutsideDevelopment=true (o gateway de testes não movimenta dinheiro).")
            .ValidateOnStart();
        services.AddOptions<MercadoPagoOptions>()
            .Bind(config.GetSection("Payments:MercadoPago"))
            .Validate(o => !isMercadoPago || !string.IsNullOrWhiteSpace(o.AccessToken), "Payments:MercadoPago:AccessToken é obrigatório com Payments:Provider=MercadoPago.")
            .Validate(o => !isMercadoPago || env.IsDevelopment() || !o.RequireSignature || !string.IsNullOrWhiteSpace(o.WebhookSecret),
                "Payments:MercadoPago:WebhookSecret é obrigatório fora de Development (ou desligue RequireSignature só em sandbox).")
            .ValidateOnStart();

        services.AddSingleton(TimeProvider.System);
        services.AddMemoryCache();
        services.AddDataProtection();
        services.AddSingleton<IFieldEncryptor, DataProtectionFieldEncryptor>();
        services.AddSingleton<IDownloadTokenService, DataProtectionDownloadTokenService>();

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var db = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<DatabaseOptions>>().Value;
            // Pedidos carregam itens + eventos + rastreio: em consulta única isso vira produto cartesiano.
            if (db.Provider == "Postgres")
                options.UseNpgsql(db.PostgresConnectionString, o => o
                    .MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)
                    .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
            else
            {
                var path = Path.GetFullPath(db.SqlitePath);
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                options.UseSqlite($"Data Source={path}", o => o.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
            }
        });
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped<DatabaseInitializer>();

        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IPasswordService, PasswordService>();
        services.AddSingleton<IGoogleTokenVerifier, GoogleTokenVerifier>();
        services.AddSingleton<ILinkBuilder, LinkBuilder>();

        services.AddProviderCatalogs();

        // ----- Pagamentos: todos os gateways disponíveis; Payments:Provider escolhe quem cria cobranças novas -----
        services.AddProvider<IPaymentGateway, FakePaymentGateway>(FakePaymentGateway.GatewayName);
        services.AddHttpClient<MercadoPagoGateway>(c => c.Timeout = TimeSpan.FromSeconds(35))
            .AddStandardResilienceHandler(o =>
            {
                o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(15);
                o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(30);
                o.Retry.MaxRetryAttempts = 2;
            });
        services.AddProvider<IPaymentGateway, MercadoPagoGateway>(MercadoPagoGateway.GatewayName, registerImplementation: false);
        services.AddScoped<IPaymentGatewayRegistry, PaymentGatewayRegistry>();

        // ----- CEP -----
        services.AddHttpClient<IPostalCodeLookup, PostalCodeLookup>(c => c.Timeout = TimeSpan.FromSeconds(12))
            .AddStandardResilienceHandler(o =>
            {
                o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(4);
                o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(10);
                o.Retry.MaxRetryAttempts = 1;
            });

        // ----- Frete: tabela própria sempre registrada (fallback); integrações entram pelo catálogo -----
        services.AddProvider<IShippingRateProvider, TableShippingRateProvider>(TableShippingRateProvider.ProviderName);
        services.AddScoped<IShippingRateProvider, CompositeShippingRateProvider>();

        // ----- Rastreio: provedores por transportadora + parsers de webhook por rota -----
        var tracking = config["Tracking:Provider"] ?? "None";
        if (tracking.Equals(FakeTrackingProvider.ProviderName, StringComparison.OrdinalIgnoreCase))
            services.AddProvider<ITrackingProvider, FakeTrackingProvider>(FakeTrackingProvider.ProviderName, ServiceLifetime.Singleton);
        services.AddProvider<ITrackingWebhookParser, GenericTrackingWebhookParser>(GenericTrackingWebhookParser.ParserName, ServiceLifetime.Singleton);
        services.AddScoped<ITrackingProviderResolver, TrackingProviderResolver>();

        // ----- Câmbio -----
        services.AddProvider<IExchangeRateProvider, ManualExchangeRateProvider>(ManualExchangeRateProvider.ProviderName, ServiceLifetime.Singleton);

        // ----- Imagens -----
        var storage = config["Storage:Provider"] ?? "Local";
        if (storage.Equals("R2", StringComparison.OrdinalIgnoreCase)) services.AddSingleton<IImageStorage, R2ImageStorage>();
        else
        {
            services.AddSingleton<LocalImageStorage>();
            services.AddSingleton<IImageStorage>(sp => sp.GetRequiredService<LocalImageStorage>());
        }

        // ----- E-mail -----
        var emailProvider = config["Email:Provider"] ?? "Log";
        if (emailProvider.Equals("Smtp", StringComparison.OrdinalIgnoreCase)) services.AddSingleton<IEmailSender, SmtpEmailSender>();
        else services.AddSingleton<IEmailSender, LoggingEmailSender>();

        services.AddHostedService<PaymentMaintenanceJob>();
        services.AddHostedService<LogisticsJob>();
        services.AddHostedService<HousekeepingJob>();
        services.AddHostedService<ExchangeRateRefreshJob>();
        return services;
    }
}
