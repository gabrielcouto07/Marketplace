using System.Diagnostics;
using System.Text.Json;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Api.Infrastructure;

/// <summary>Converte exceções em ApiErrorDto (application/problem+json) — o formato que o front espera.</summary>
public static class ApiProblems
{
    public const string ContentType = "application/problem+json";

    public static Task WriteAsync(HttpContext context, int status, string code, string message, IReadOnlyDictionary<string, string[]>? errors = null)
    {
        var json = context.RequestServices.GetRequiredService<JsonSerializerOptions>();
        var traceId = Activity.Current?.Id ?? context.TraceIdentifier;
        context.Response.StatusCode = status;
        context.Response.ContentType = ContentType;
        return context.Response.WriteAsync(JsonSerializer.Serialize(new ApiErrorDto(status, code, message, errors, traceId), json), context.RequestAborted);
    }

    /// <summary>Status sem corpo (404 de rota, 405, 415...) no mesmo formato.</summary>
    public static Task WriteStatusAsync(HttpContext context)
    {
        var status = context.Response.StatusCode;
        var (code, message) = status switch
        {
            404 => ("NOT_FOUND", "Rota não encontrada."),
            405 => ("METHOD_NOT_ALLOWED", "Método não permitido nesta rota."),
            415 => ("UNSUPPORTED_MEDIA_TYPE", "Envie o corpo como application/json."),
            _ => ($"HTTP_{status}", "Requisição não atendida."),
        };
        return WriteAsync(context, status, code, message);
    }

    public sealed class ExceptionHandler(ILogger<ExceptionHandler> logger, IHostEnvironment env) : IExceptionHandler
    {
        public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
        {
            switch (exception)
            {
                case AppException app:
                    await WriteAsync(context, app.Status, app.Code, app.Message, app.Errors);
                    return true;
                case BadHttpRequestException bad:
                    await WriteAsync(context, 400, "BAD_REQUEST", env.IsDevelopment() ? bad.Message : "Requisição inválida.");
                    return true;
                case JsonException json:
                    await WriteAsync(context, 400, "INVALID_JSON", env.IsDevelopment() ? json.Message : "Corpo da requisição inválido.");
                    return true;
                case UnauthorizedAccessException:
                    await WriteAsync(context, 401, "UNAUTHORIZED", "Assinatura ou credencial inválida.");
                    return true;
                case OperationCanceledException when context.RequestAborted.IsCancellationRequested:
                    return true;
                case DbUpdateConcurrencyException:
                    await WriteAsync(context, 409, "CONCURRENCY_CONFLICT", "Os dados mudaram enquanto você editava. Tente novamente.");
                    return true;
                case DbUpdateException dbEx:
                    logger.LogWarning(dbEx, "Conflito ao salvar em {Method} {Path}", context.Request.Method, context.Request.Path);
                    await WriteAsync(context, 409, "DATA_CONFLICT", "Conflito ao salvar os dados. Tente novamente.");
                    return true;
                case HttpRequestException httpEx:
                    logger.LogError(httpEx, "Serviço externo falhou em {Method} {Path}", context.Request.Method, context.Request.Path);
                    await WriteAsync(context, 502, "UPSTREAM_UNAVAILABLE", "Serviço externo indisponível. Tente novamente em instantes.");
                    return true;
                case TimeoutException or TaskCanceledException:
                    logger.LogError(exception, "Tempo esgotado em {Method} {Path}", context.Request.Method, context.Request.Path);
                    await WriteAsync(context, 504, "UPSTREAM_TIMEOUT", "Serviço externo demorou demais. Tente novamente.");
                    return true;
                default:
                    logger.LogError(exception, "Erro não tratado em {Method} {Path}", context.Request.Method, context.Request.Path);
                    await WriteAsync(context, 500, "INTERNAL_ERROR", env.IsDevelopment() ? exception.Message : "Erro interno. Tente novamente.");
                    return true;
            }
        }
    }
}
