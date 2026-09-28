using System.Text.Json;
using System.Text.RegularExpressions;
using Marketplace.Application.Abstractions;
using Marketplace.Domain;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Marketplace.Infrastructure.Persistence;

public sealed partial class AppDbContext(DbContextOptions<AppDbContext> options, IFieldEncryptor encryptor)
    : DbContext(options), IAppDbContext
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Seller> Sellers => Set<Seller>();
    public DbSet<SellerCategory> SellerCategories => Set<SellerCategory>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<Banner> Banners => Set<Banner>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Address> Addresses => Set<Address>();
    public DbSet<Favorite> Favorites => Set<Favorite>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<Consent> Consents => Set<Consent>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ExchangeRate> ExchangeRates => Set<ExchangeRate>();
    public DbSet<ShippingZone> ShippingZones => Set<ShippingZone>();
    public DbSet<CheckoutQuote> CheckoutQuotes => Set<CheckoutQuote>();
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderEvent> OrderEvents => Set<OrderEvent>();
    public DbSet<TrackingEvent> TrackingEvents => Set<TrackingEvent>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Payout> Payouts => Set<Payout>();
    public DbSet<WebhookEvent> WebhookEvents => Set<WebhookEvent>();
    public DbSet<PlatformSettings> PlatformSettings => Set<PlatformSettings>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        var encrypted = new ValueConverter<string?, string?>(
            v => v == null ? null : encryptor.Protect(v),
            v => v == null ? null : encryptor.Unprotect(v));

        b.Entity<Category>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Slug).HasMaxLength(120);
            e.Property(x => x.Name).HasMaxLength(120);
        });

        b.Entity<Seller>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.Ruc).IsUnique();
            e.Property(x => x.Slug).HasMaxLength(120);
            e.Property(x => x.Name).HasMaxLength(160);
            e.Property(x => x.Ruc).HasMaxLength(16);
            e.Property(x => x.Country).HasMaxLength(2);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        });

        b.Entity<SellerCategory>(e =>
        {
            e.HasKey(x => new { x.SellerId, x.CategoryId });
            e.HasOne(x => x.Seller).WithMany(s => s.Categories).HasForeignKey(x => x.SellerId);
            e.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId);
        });

        b.Entity<Product>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.SearchText);
            e.HasIndex(x => new { x.SellerId, x.Status });
            e.HasIndex(x => new { x.CategoryId, x.Status });
            e.Property(x => x.Slug).HasMaxLength(200);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.SearchText).HasMaxLength(400);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.VariantOptions).HasConversion(Json<List<VariantOption>>(), ListComparer<VariantOption>());
            e.Property(x => x.Attributes).HasConversion(Json<List<ProductAttribute>>(), ListComparer<ProductAttribute>());
            e.HasOne(x => x.Seller).WithMany(s => s.Products).HasForeignKey(x => x.SellerId);
            e.HasOne(x => x.Category).WithMany(c => c.Products).HasForeignKey(x => x.CategoryId);
            e.HasMany(x => x.Images).WithOne().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Variants).WithOne().HasForeignKey(v => v.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Reviews).WithOne().HasForeignKey(r => r.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Questions).WithOne().HasForeignKey(q => q.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.Ignore(x => x.Price).Ignore(x => x.CompareAtPrice).Ignore(x => x.DiscountPercent).Ignore(x => x.IsOffer);
        });

        b.Entity<ProductVariant>(e =>
        {
            e.HasIndex(x => new { x.ProductId, x.Sku }).IsUnique();
            e.Property(x => x.Sku).HasMaxLength(64);
            e.Property(x => x.Attributes).HasConversion(Json<Dictionary<string, string>>(), DictionaryComparer());
            e.Ignore(x => x.Price).Ignore(x => x.CompareAtPrice).Ignore(x => x.Label);
        });

        b.Entity<ProductImage>(e => e.Property(x => x.Url).HasMaxLength(1024));

        b.Entity<Review>(e =>
        {
            e.HasIndex(x => x.SellerId);
            e.HasIndex(x => new { x.ProductId, x.UserId });
            e.Property(x => x.AuthorName).HasMaxLength(120);
        });

        b.Entity<Question>(e => e.Property(x => x.AskedByName).HasMaxLength(120));

        b.Entity<Banner>(e => e.Property(x => x.Tone).HasConversion<string>().HasMaxLength(16));

        b.Entity<Coupon>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Code).HasMaxLength(40);
        });

        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.HasIndex(x => x.GoogleSubject);
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.FullName).HasMaxLength(160);
            e.Property(x => x.Cpf).HasConversion(encrypted).HasMaxLength(512);
            e.Property(x => x.Roles).HasConversion(
                v => string.Join(',', v.Select(r => r.ToString())),
                v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(Enum.Parse<UserRole>).ToList(),
                ListComparer<UserRole>()).HasMaxLength(64);
            e.HasMany(x => x.Addresses).WithOne().HasForeignKey(a => a.UserId);
            e.HasMany(x => x.RefreshTokens).WithOne(t => t.User).HasForeignKey(t => t.UserId);
            e.Ignore(x => x.IsActive);
        });

        b.Entity<RefreshToken>(e =>
        {
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.Property(x => x.TokenHash).HasMaxLength(64);
        });

        b.Entity<PasswordResetToken>(e =>
        {
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.Property(x => x.TokenHash).HasMaxLength(64);
        });

        b.Entity<Address>(e =>
        {
            e.HasIndex(x => x.UserId);
            e.Property(x => x.PostalCode).HasMaxLength(8);
            e.Property(x => x.State).HasMaxLength(2);
            e.Property(x => x.Country).HasMaxLength(2);
        });

        b.Entity<Favorite>(e => e.HasKey(x => new { x.UserId, x.ProductId }));
        b.Entity<CartItem>(e => e.HasKey(x => new { x.UserId, x.ProductId, x.VariantId }));

        b.Entity<Consent>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.Type });
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.Version).HasMaxLength(32);
        });

        b.Entity<AuditLog>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.OccurredAt });
            e.Property(x => x.Action).HasMaxLength(64);
        });

        b.Entity<ExchangeRate>(e =>
        {
            e.HasIndex(x => new { x.From, x.To, x.QuotedAt });
            e.Property(x => x.From).HasConversion<string>().HasMaxLength(3);
            e.Property(x => x.To).HasConversion<string>().HasMaxLength(3);
            e.Property(x => x.DisplayRate).HasMaxLength(64);
        });

        b.Entity<ShippingZone>(e =>
        {
            e.HasIndex(x => x.Prefix).IsUnique();
            e.Property(x => x.Prefix).HasMaxLength(2);
            e.Property(x => x.State).HasMaxLength(2);
        });

        b.Entity<CheckoutQuote>(e => e.HasIndex(x => x.LockedUntil));

        b.Entity<Purchase>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.IdempotencyKey }).IsUnique();
            e.Property(x => x.IdempotencyKey).HasMaxLength(128);
            e.HasMany(x => x.Orders).WithOne(o => o.Purchase).HasForeignKey(o => o.PurchaseId);
            e.HasOne(x => x.Payment).WithMany().HasForeignKey(x => x.PaymentId);
        });

        b.Entity<Order>(e =>
        {
            e.HasIndex(x => x.Number).IsUnique();
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.HasIndex(x => new { x.SellerId, x.Status });
            e.HasIndex(x => x.PaymentId);
            e.Property(x => x.Number).HasMaxLength(24);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            e.Property(x => x.ShippingAddress).HasConversion(JsonRecord<AddressSnapshot>());
            e.Property(x => x.ShippingOption).HasConversion(JsonRecord<ShippingOptionSnapshot>());
            e.HasOne(x => x.Seller).WithMany().HasForeignKey(x => x.SellerId);
            e.HasOne(x => x.ExchangeRate).WithMany().HasForeignKey(x => x.ExchangeRateId);
            e.HasOne(x => x.Payment).WithMany().HasForeignKey(x => x.PaymentId);
            e.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Events).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.TrackingEvents).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.Ignore(x => x.CanBeCancelled).Ignore(x => x.CanOpenDispute);
        });

        b.Entity<OrderEvent>(e => e.Property(x => x.Status).HasConversion<string>().HasMaxLength(32));

        b.Entity<TrackingEvent>(e =>
        {
            e.HasIndex(x => new { x.OrderId, x.ExternalId });
            e.Property(x => x.Code).HasMaxLength(40);
        });

        b.Entity<Payment>(e =>
        {
            e.HasIndex(x => x.PurchaseId);
            e.HasIndex(x => x.GatewayPaymentId);
            e.HasIndex(x => new { x.Status, x.ExpiresAt });
            e.Property(x => x.Method).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
            e.Property(x => x.Currency).HasConversion<string>().HasMaxLength(3);
            e.Property(x => x.Gateway).HasMaxLength(32);
            e.Property(x => x.PayerDocument).HasConversion(encrypted).HasMaxLength(512);
            e.Ignore(x => x.Money).Ignore(x => x.IsFinal);
        });

        b.Entity<Payout>(e =>
        {
            e.HasIndex(x => x.OrderId).IsUnique();
            e.HasIndex(x => new { x.SellerId, x.Status });
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        });

        b.Entity<WebhookEvent>(e =>
        {
            e.HasIndex(x => new { x.Provider, x.ExternalId }).IsUnique();
            e.Property(x => x.Provider).HasMaxLength(32);
            e.Property(x => x.ExternalId).HasMaxLength(128);
            e.Property(x => x.Type).HasMaxLength(64);
        });

        b.Entity<PlatformSettings>(e =>
        {
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.ImportTaxMode).HasConversion<string>().HasMaxLength(24);
        });

        ApplyConventions(b);
    }

    /// <summary>snake_case em tabelas/colunas e DateTime sempre UTC (SQLite devolve Unspecified; Npgsql exige Utc).</summary>
    private static void ApplyConventions(ModelBuilder b)
    {
        var utc = new ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        var utcNullable = new ValueConverter<DateTime?, DateTime?>(
            v => v == null ? null : v.Value.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc),
            v => v == null ? null : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc));

        foreach (var entity in b.Model.GetEntityTypes())
        {
            var table = entity.GetTableName();
            if (table is not null) entity.SetTableName(ToSnakeCase(table));
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.GetColumnName()));
                if (property.ClrType == typeof(DateTime)) property.SetValueConverter(utc);
                else if (property.ClrType == typeof(DateTime?)) property.SetValueConverter(utcNullable);
            }
            foreach (var key in entity.GetKeys()) key.SetName(ToSnakeCase(key.GetName()!));
            foreach (var fk in entity.GetForeignKeys()) fk.SetConstraintName(ToSnakeCase(fk.GetConstraintName()!));
            foreach (var index in entity.GetIndexes()) index.SetDatabaseName(ToSnakeCase(index.GetDatabaseName()!));
        }
    }

    private static string ToSnakeCase(string name) =>
        SnakeCasePattern().Replace(name, "_$1").ToLowerInvariant();

    [GeneratedRegex("(?<=[a-z0-9])([A-Z])")]
    private static partial Regex SnakeCasePattern();

    private static ValueConverter<T, string> Json<T>() where T : class, new() =>
        new(v => JsonSerializer.Serialize(v, JsonOptions), v => JsonSerializer.Deserialize<T>(v, JsonOptions) ?? new T());

    private static ValueConverter<T, string> JsonRecord<T>() where T : class =>
        new(v => JsonSerializer.Serialize(v, JsonOptions), v => JsonSerializer.Deserialize<T>(v, JsonOptions)!);

    private static ValueComparer<List<T>> ListComparer<T>() =>
        new((a, c) => (a == null && c == null) || (a != null && c != null && a.SequenceEqual(c)),
            v => v.Aggregate(0, (h, x) => HashCode.Combine(h, x)),
            v => v.ToList());

    private static ValueComparer<Dictionary<string, string>> DictionaryComparer() =>
        new((a, c) => (a == null && c == null) || (a != null && c != null && a.Count == c.Count && !a.Except(c).Any()),
            v => v.Aggregate(0, (h, kv) => HashCode.Combine(h, kv.Key, kv.Value)),
            v => new Dictionary<string, string>(v));
}
