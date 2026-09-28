namespace Marketplace.Application.Common;

/// <summary>Erro de negócio traduzido para ProblemDetails simplificado ({ status, code, message, errors, traceId }).</summary>
public class AppException(int status, string code, string message, IReadOnlyDictionary<string, string[]>? errors = null)
    : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    public IReadOnlyDictionary<string, string[]>? Errors { get; } = errors;

    public static AppException NotFound(string what) => new(404, "NOT_FOUND", $"{what} não encontrado.");
    public static AppException Unauthorized(string? message = null) =>
        new(401, "UNAUTHORIZED", message ?? "Sessão inválida ou expirada.");
    public static AppException Forbidden(string? message = null) =>
        new(403, "FORBIDDEN", message ?? "Você não tem permissão para esta ação.");
    public static AppException Conflict(string code, string message) => new(409, code, message);
    public static AppException Validation(string field, string message) =>
        new(422, "VALIDATION_ERROR", "Um ou mais campos são inválidos.", new Dictionary<string, string[]> { [field] = [message] });
    public static AppException Validation(IReadOnlyDictionary<string, string[]> errors) =>
        new(422, "VALIDATION_ERROR", "Um ou mais campos são inválidos.", errors);
    public static AppException BadGateway(string code, string message) => new(502, code, message);
}

/// <summary>Acumulador de erros de validação por campo (mesmo formato de ApiErrorDto.errors).</summary>
public sealed class ValidationErrors
{
    private readonly Dictionary<string, List<string>> _errors = [];

    public bool HasErrors => _errors.Count > 0;

    public ValidationErrors Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var list)) _errors[field] = list = [];
        list.Add(message);
        return this;
    }

    public ValidationErrors AddIf(bool condition, string field, string message) =>
        condition ? Add(field, message) : this;

    public void ThrowIfAny()
    {
        if (HasErrors)
            throw AppException.Validation(_errors.ToDictionary(k => k.Key, v => v.Value.ToArray()));
    }
}
