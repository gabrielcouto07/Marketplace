using Marketplace.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Marketplace.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<PlatformSettingsProvider>();
        services.AddScoped<ExchangeRateService>();
        services.AddScoped<CatalogService>();
        services.AddScoped<SellerService>();
        services.AddScoped<ShippingService>();
        services.AddScoped<CheckoutService>();
        services.AddScoped<OrderService>();
        services.AddScoped<PaymentService>();
        services.AddScoped<PayoutService>();
        services.AddScoped<AuthService>();
        services.AddScoped<AccountService>();
        services.AddScoped<PrivacyService>();
        return services;
    }
}
