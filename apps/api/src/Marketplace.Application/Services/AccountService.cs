using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

public sealed class AccountService(IAppDbContext db, ICurrentUser currentUser, TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    private static readonly HashSet<string> BrazilianStates =
    [
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
        "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
    ];

    public async Task<User> RequireUserAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        return await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.AnonymizedAt == null, ct)
               ?? throw AppException.Unauthorized();
    }

    public async Task<UserProfileDto> MeAsync(CancellationToken ct) => (await RequireUserAsync(ct)).ToDto();

    public async Task<UserProfileDto> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken ct)
    {
        var user = await RequireUserAsync(ct);
        var fullName = request.FullName?.Trim() ?? string.Empty;
        var phone = Documents.OnlyDigits(request.Phone);
        var cpf = Documents.OnlyDigits(request.Cpf);
        new ValidationErrors()
            .AddIf(fullName.Length < 3, "fullName", "Informe seu nome completo.")
            .AddIf(phone.Length is not (0 or 10 or 11), "phone", "Telefone inválido.")
            .AddIf(cpf.Length > 0 && !Documents.IsValidCpf(cpf), "cpf", "CPF inválido.")
            .ThrowIfAny();
        user.FullName = fullName;
        user.Phone = phone.Length == 0 ? null : phone;
        user.Cpf = cpf.Length == 0 ? null : cpf;
        user.UpdatedAt = Now;
        db.AuditLogs.Add(new AuditLog { UserId = user.Id, Action = "profile.update", OccurredAt = Now, IpAddress = currentUser.IpAddress });
        await db.SaveChangesAsync(ct);
        return user.ToDto();
    }

    // ----- Endereços -----

    public async Task<IReadOnlyList<AddressDto>> AddressesAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var list = await db.Addresses.AsNoTracking()
            .Where(a => a.UserId == userId && a.DeletedAt == null)
            .OrderByDescending(a => a.IsDefault).ThenBy(a => a.CreatedAt)
            .ToListAsync(ct);
        return list.Select(a => a.ToDto()).ToList();
    }

    public async Task<AddressDto> CreateAddressAsync(AddressInput input, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var validated = Validate(input);
        var others = await db.Addresses.Where(a => a.UserId == userId && a.DeletedAt == null).ToListAsync(ct);
        var address = new Address
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Label = validated.Label,
            RecipientName = validated.RecipientName,
            PostalCode = validated.PostalCode,
            Street = validated.Street,
            Number = validated.Number,
            Complement = validated.Complement,
            Neighborhood = validated.Neighborhood,
            City = validated.City,
            State = validated.State,
            Phone = validated.Phone,
            IsDefault = input.IsDefault || others.Count == 0,
            CreatedAt = Now,
        };
        if (address.IsDefault) foreach (var o in others) o.IsDefault = false;
        db.Addresses.Add(address);
        await db.SaveChangesAsync(ct);
        return address.ToDto();
    }

    public async Task<AddressDto> UpdateAddressAsync(Guid id, AddressInput input, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var address = await db.Addresses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId && a.DeletedAt == null, ct)
                      ?? throw AppException.NotFound("Endereço");
        var validated = Validate(input);
        address.Label = validated.Label;
        address.RecipientName = validated.RecipientName;
        address.PostalCode = validated.PostalCode;
        address.Street = validated.Street;
        address.Number = validated.Number;
        address.Complement = validated.Complement;
        address.Neighborhood = validated.Neighborhood;
        address.City = validated.City;
        address.State = validated.State;
        address.Phone = validated.Phone;
        if (input.IsDefault && !address.IsDefault)
        {
            var others = await db.Addresses.Where(a => a.UserId == userId && a.Id != id && a.DeletedAt == null).ToListAsync(ct);
            foreach (var o in others) o.IsDefault = false;
        }
        address.IsDefault = input.IsDefault || address.IsDefault;
        await db.SaveChangesAsync(ct);
        return address.ToDto();
    }

    public async Task DeleteAddressAsync(Guid id, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var address = await db.Addresses.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId && a.DeletedAt == null, ct)
                      ?? throw AppException.NotFound("Endereço");
        // Soft delete: pedidos guardam snapshot, mas mantemos a linha para auditoria.
        address.DeletedAt = Now;
        address.IsDefault = false;
        var remaining = await db.Addresses.Where(a => a.UserId == userId && a.Id != id && a.DeletedAt == null).OrderBy(a => a.CreatedAt).ToListAsync(ct);
        if (remaining.Count > 0 && !remaining.Any(a => a.IsDefault)) remaining[0].IsDefault = true;
        await db.SaveChangesAsync(ct);
    }

    private sealed record ValidatedAddress(string Label, string RecipientName, string PostalCode, string Street, string Number, string? Complement, string Neighborhood, string City, string State, string? Phone);

    private static ValidatedAddress Validate(AddressInput input)
    {
        var cep = Documents.OnlyDigits(input.PostalCode);
        var phone = Documents.OnlyDigits(input.Phone);
        var state = (input.State ?? string.Empty).Trim().ToUpperInvariant();
        new ValidationErrors()
            .AddIf(string.IsNullOrWhiteSpace(input.Label), "label", "Dê um nome para o endereço (ex.: Casa).")
            .AddIf(string.IsNullOrWhiteSpace(input.RecipientName) || input.RecipientName.Trim().Length < 3, "recipientName", "Informe quem vai receber.")
            .AddIf(cep.Length != 8, "postalCode", "CEP inválido.")
            .AddIf(string.IsNullOrWhiteSpace(input.Street), "street", "Informe a rua.")
            .AddIf(string.IsNullOrWhiteSpace(input.Number), "number", "Informe o número.")
            .AddIf(string.IsNullOrWhiteSpace(input.Neighborhood), "neighborhood", "Informe o bairro.")
            .AddIf(string.IsNullOrWhiteSpace(input.City), "city", "Informe a cidade.")
            .AddIf(!BrazilianStates.Contains(state), "state", "UF inválida.")
            .AddIf(phone.Length is not (0 or 10 or 11), "phone", "Telefone inválido.")
            .ThrowIfAny();
        return new ValidatedAddress(
            input.Label!.Trim(), input.RecipientName!.Trim(), cep, input.Street!.Trim(), input.Number!.Trim(),
            string.IsNullOrWhiteSpace(input.Complement) ? null : input.Complement.Trim(),
            input.Neighborhood!.Trim(), input.City!.Trim(), state, phone.Length == 0 ? null : phone);
    }

    // ----- Favoritos / carrinho (sincronização do estado local) -----

    public async Task<IReadOnlyList<FavoriteDto>> FavoritesAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var list = await db.Favorites.AsNoTracking().Where(f => f.UserId == userId).OrderByDescending(f => f.CreatedAt).ToListAsync(ct);
        return list.Select(f => new FavoriteDto(f.ProductId, f.CreatedAt)).ToList();
    }

    public async Task<IReadOnlyList<FavoriteDto>> ReplaceFavoritesAsync(IReadOnlyList<FavoriteDto>? favorites, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var incoming = (favorites ?? []).GroupBy(f => f.ProductId).Select(g => g.First()).ToList();
        var validIds = await db.Products.Where(p => incoming.Select(f => f.ProductId).Contains(p.Id)).Select(p => p.Id).ToListAsync(ct);
        var existing = await db.Favorites.Where(f => f.UserId == userId).ToListAsync(ct);
        db.Favorites.RemoveRange(existing);
        db.Favorites.AddRange(incoming.Where(f => validIds.Contains(f.ProductId))
            .Select(f => new Favorite { UserId = userId, ProductId = f.ProductId, CreatedAt = f.CreatedAt == default ? Now : f.CreatedAt }));
        await db.SaveChangesAsync(ct);
        return await FavoritesAsync(ct);
    }

    public async Task<CartDto> CartAsync(CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var items = await db.CartItems.AsNoTracking().Where(c => c.UserId == userId).ToListAsync(ct);
        return new CartDto(
            userId,
            items.Select(i => new CartLineDto(i.ProductId, i.VariantId == Guid.Empty ? null : i.VariantId, i.Quantity)).ToList(),
            items.Count == 0 ? Now : items.Max(i => i.UpdatedAt));
    }

    public async Task<CartDto> ReplaceCartAsync(IReadOnlyList<CartLineDto>? lines, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var incoming = (lines ?? []).Where(l => l.Quantity > 0)
            .GroupBy(l => (l.ProductId, l.VariantId ?? Guid.Empty))
            .Select(g => new CartItem { UserId = userId, ProductId = g.Key.ProductId, VariantId = g.Key.Item2, Quantity = g.Sum(x => x.Quantity), UpdatedAt = Now })
            .ToList();
        var existing = await db.CartItems.Where(c => c.UserId == userId).ToListAsync(ct);
        db.CartItems.RemoveRange(existing);
        db.CartItems.AddRange(incoming);
        await db.SaveChangesAsync(ct);
        return await CartAsync(ct);
    }
}
