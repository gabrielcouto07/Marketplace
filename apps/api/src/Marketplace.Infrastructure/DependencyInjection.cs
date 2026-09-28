using Marketplace.Application.Abstractions;
using Marketplace.Application.Services;
using Marketplace.Infrastructure.Auth;
using Marketplace.Infrastructure.Background;
using Marketplace.Infrastructure.Email;
using Marketplace.Infrastructure.Links;
using Marketplace.Infrastructure.Payments;
using Marketplace.Infrastructure.Persistence;
using Marketplace.Infrastructure.Security;
using Marketplace.Infrastructure.Shipping;
using Marketplace.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Marketplace.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<DatabaseOptions>(o =>
        {
            config.GetSection("Database").Bind(o);
            var postgres = config.GetConnectionString("Postgres");
            if (!string.IsNullOrWhiteSpace(postgres))
            {
                o.Provider = "Postgres";
                o.PostgresConnectionString = postgres;
            }
        });
        services.Configure<JwtOptions>(config.GetSection("Auth:Jwt"));
        services.Configure<AuthOptions>(config.GetSection("Auth"));
        services.Configure<GoogleOptions>(config.GetSection("Auth:Google"));
        services.Configure<PrivacyOptions>(config.GetSection("Privacy"));
        services.Configure<LinkOptions>(config.GetSection("Links"));
        services.Configure<FakePaymentOptions>(config.GetSection("Payments:Fake"));
        services.Configure<MercadoPagoOptions>(config.GetSection("Payments:MercadoPago"));
        services.Configure<PostalCodeOptions>(config.GetSection("PostalCodes"));
        services.Configure<TrackingOptions>(config.GetSection("Tracking"));
        services.Configure<StorageOptions>(config.GetSection("Storage"));
        services.Configure<EmailOptions>(config.GetSection("Email"));

        services.AddSingleton(TimeProvider.System);
        services.AddMemoryCache();
        services.AddDataProtection();
        services.AddSingleton<IFieldEncryptor, DataProtectionFieldEncryptor>();

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var db = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<DatabaseOptions>>().Value;
            if (db.Provider == "Postgres")
                options.UseNpgsql(db.PostgresConnectionString, o => o.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
            else
            {
                var path = Path.GetFullPath(db.SqlitePath);
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                options.UseSqlite($"Data Source={path}");
            }
        });
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped<DatabaseInitializer>();

        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IPasswordService, PasswordService>();
        services.AddSingleton<IGoogleTokenVerifier, GoogleTokenVerifier>();
        services.AddSingleton<ILinkBuilder, LinkBuilder>();

        var paymentProvider = config["Payments:Provider"] ?? "Fake";
        if (paymentProvider.Equals("MercadoPago", StringComparison.OrdinalIgnoreCase))
            services.AddHttpClient<IPaymentGateway, MercadoPagoGateway>(c => c.Timeout = TimeSpan.FromSeconds(20));
        else
            services.AddScoped<IPaymentGateway, FakePaymentGateway>();

        services.AddHttpClient<IPostalCodeLookup, PostalCodeLookup>(c => c.Timeout = TimeSpan.FromSeconds(6));
        services.AddScoped<IShippingRateProvider, TableShippingRateProvider>();

        var tracking = config["Tracking:Provider"] ?? "None";
        if (tracking.Equals("Fake", StringComparison.OrdinalIgnoreCase)) services.AddSingleton<ITrackingProvider, FakeTrackingProvider>();
        else services.AddSingleton<ITrackingProvider, NullTrackingProvider>();

        var storage = config["Storage:Provider"] ?? "Local";
        if (storage.Equals("R2", StringComparison.OrdinalIgnoreCase)) services.AddSingleton<IImageStorage, R2ImageStorage>();
        else
        {
            services.AddSingleton<LocalImageStorage>();
            services.AddSingleton<IImageStorage>(sp => sp.GetRequiredService<LocalImageStorage>());
        }

        var emailProvider = config["Email:Provider"] ?? "Log";
        if (emailProvider.Equals("Smtp", StringComparison.OrdinalIgnoreCase)) services.AddSingleton<IEmailSender, SmtpEmailSender>();
        else services.AddSingleton<IEmailSender, LoggingEmailSender>();

        services.AddHostedService<PaymentMaintenanceJob>();
        services.AddHostedService<LogisticsJob>();
        return services;
    }
}
