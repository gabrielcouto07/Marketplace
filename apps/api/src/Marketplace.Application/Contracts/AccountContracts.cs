using Marketplace.Domain;

namespace Marketplace.Application.Contracts;

public sealed record UserProfileDto(
    Guid Id,
    string FullName,
    string Email,
    string? Phone,
    string? Cpf,
    string? AvatarUrl,
    IReadOnlyList<UserRole> Roles,
    DateTime CreatedAt);

public sealed record LoginRequest(string? Email, string? Password);

public sealed record RegisterRequest(string? FullName, string? Email, string? Phone, string? Password, bool? AcceptTerms);

public sealed record GoogleAuthRequest(string? IdToken);

public sealed record ForgotPasswordRequest(string? Email);

public sealed record ResetPasswordRequest(string? Token, string? Password);

public sealed record RefreshRequest(string? RefreshToken);

public sealed record AuthResponseDto(string AccessToken, string RefreshToken, DateTime ExpiresAt, UserProfileDto User);

public sealed record UpdateProfileRequest(string? FullName, string? Phone, string? Cpf);

public sealed record DeleteAccountRequest(string? Password, string? Confirmation);

// ----- LGPD -----

public sealed record ConsentDto(ConsentType Type, string Version, DateTime AcceptedAt, DateTime? RevokedAt);

public sealed record ConsentInput(ConsentType Type, bool Granted);

public sealed record PrivacyPolicyDto(
    string TermsVersion,
    string PrivacyPolicyVersion,
    string TermsUrl,
    string PrivacyPolicyUrl,
    string DataControllerEmail,
    IReadOnlyList<string> Purposes);

public sealed record PersonalDataExportDto(
    DateTime GeneratedAt,
    UserProfileDto Profile,
    IReadOnlyList<AddressDto> Addresses,
    IReadOnlyList<OrderDto> Orders,
    IReadOnlyList<ConsentDto> Consents,
    IReadOnlyList<QuestionDto> Questions,
    IReadOnlyList<ReviewDto> Reviews);
