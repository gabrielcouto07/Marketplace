using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Marketplace.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<Category> Categories { get; }
    DbSet<Seller> Sellers { get; }
    DbSet<SellerCategory> SellerCategories { get; }
    DbSet<Product> Products { get; }
    DbSet<ProductImage> ProductImages { get; }
    DbSet<ProductVariant> ProductVariants { get; }
    DbSet<Review> Reviews { get; }
    DbSet<Question> Questions { get; }
    DbSet<Banner> Banners { get; }
    DbSet<Coupon> Coupons { get; }

    DbSet<User> Users { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<PasswordResetToken> PasswordResetTokens { get; }
    DbSet<Address> Addresses { get; }
    DbSet<Favorite> Favorites { get; }
    DbSet<CartItem> CartItems { get; }
    DbSet<Consent> Consents { get; }
    DbSet<AuditLog> AuditLogs { get; }

    DbSet<ExchangeRate> ExchangeRates { get; }
    DbSet<ShippingZone> ShippingZones { get; }
    DbSet<CheckoutQuote> CheckoutQuotes { get; }
    DbSet<Purchase> Purchases { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<OrderEvent> OrderEvents { get; }
    DbSet<TrackingEvent> TrackingEvents { get; }
    DbSet<Payment> Payments { get; }
    DbSet<Payout> Payouts { get; }
    DbSet<WebhookEvent> WebhookEvents { get; }
    DbSet<PlatformSettings> PlatformSettings { get; }

    DbSet<Shipment> Shipments { get; }
    DbSet<ShipmentLabel> ShipmentLabels { get; }
    DbSet<TaxRemittance> TaxRemittances { get; }
    DbSet<ComplianceOccurrence> ComplianceOccurrences { get; }
    DbSet<ProductReport> ProductReports { get; }

    DatabaseFacade Database { get; }
    ChangeTracker ChangeTracker { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
