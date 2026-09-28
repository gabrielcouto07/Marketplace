namespace Marketplace.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public required string FullName { get; set; }
    /// <summary>Sempre minúsculo e sem espaços (índice único).</summary>
    public required string Email { get; set; }
    public string? PasswordHash { get; set; }
    public string? Phone { get; set; }
    /// <summary>Somente dígitos (11). Cifrado em repouso pelo provider de persistência.</summary>
    public string? Cpf { get; set; }
    public string? AvatarUrl { get; set; }
    public List<UserRole> Roles { get; set; } = [UserRole.Comprador];
    public string? GoogleSubject { get; set; }
    public bool EmailVerified { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    /// <summary>LGPD: conta encerrada e dados pessoais anonimizados.</summary>
    public DateTime? AnonymizedAt { get; set; }

    public List<Address> Addresses { get; set; } = [];
    public List<RefreshToken> RefreshTokens { get; set; } = [];

    public bool IsActive => AnonymizedAt is null;
    public bool HasRole(UserRole role) => Roles.Contains(role);
}

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    /// <summary>SHA-256 do token (o token em claro só trafega uma vez).</summary>
    public required string TokenHash { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByHash { get; set; }
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }

    public bool IsActive(DateTime now) => RevokedAt is null && ExpiresAt > now;
}

public class PasswordResetToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string TokenHash { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}

public class Address
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string Label { get; set; }
    public required string RecipientName { get; set; }
    /// <summary>8 dígitos.</summary>
    public required string PostalCode { get; set; }
    public required string Street { get; set; }
    public required string Number { get; set; }
    public string? Complement { get; set; }
    public required string Neighborhood { get; set; }
    public required string City { get; set; }
    public required string State { get; set; }
    public string Country { get; set; } = "BR";
    public string? Phone { get; set; }
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}

public class Favorite
{
    public Guid UserId { get; set; }
    public Guid ProductId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CartItem
{
    public Guid UserId { get; set; }
    public Guid ProductId { get; set; }
    /// <summary>Guid.Empty quando não há variante (chave composta não aceita nulo).</summary>
    public Guid VariantId { get; set; }
    public int Quantity { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>LGPD: registro de consentimento (art. 8º) com versão do documento aceito.</summary>
public class Consent
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ConsentType Type { get; set; }
    public required string Version { get; set; }
    public DateTime AcceptedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}

/// <summary>Trilha de auditoria de operações sensíveis (acesso, exportação e exclusão de dados).</summary>
public class AuditLog
{
    public long Id { get; set; }
    public Guid? UserId { get; set; }
    public required string Action { get; set; }
    public string? Target { get; set; }
    public DateTime OccurredAt { get; set; }
    public string? IpAddress { get; set; }
    public string? Details { get; set; }
}
