using System.Security.Claims;
using System.Threading.RateLimiting;
using Marketplace.Api.Endpoints;
using Marketplace.Api.Infrastructure;
using Marketplace.Application;
using Marketplace.Application.Abstractions;
using Marketplace.Infrastructure;
using Marketplace.Infrastructure.Auth;
using Marketplace.Infrastructure.Payments;
using Marketplace.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ----- JSON (camelCase, enums string, datas UTC "Z") -----
var jsonOptions = JsonSetup.Create();
builder.Services.AddSingleton(jsonOptions);
builder.Services.ConfigureHttpJsonOptions(o => JsonSetup.Configure(o.SerializerOptions));
// Erros de binding (JSON inválido, tipo errado) viram exceção e saem como problem+json em todos os ambientes.
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);

// ----- Camadas -----
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<ICatalogCache, OutputCatalogCache>();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(config, builder.Environment);

var keysPath = config["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(keysPath))
{
    Directory.CreateDirectory(keysPath);
    builder.Services.AddDataProtection().SetApplicationName("marketplace-py").PersistKeysToFileSystem(new DirectoryInfo(keysPath));
}

// ----- Auth (JWT Bearer) -----
var jwtSecret = config["Auth:Jwt:Secret"];
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
    throw new InvalidOperationException("Auth:Jwt:Secret precisa ter pelo menos 32 caracteres (use user-secrets ou variável de ambiente Auth__Jwt__Secret).");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    var jwt = config.GetSection("Auth:Jwt").Get<JwtOptions>() ?? new JwtOptions();
    jwt.Secret = jwtSecret;
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwt.Issuer,
        ValidateAudience = true,
        ValidAudience = jwt.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = jwt.SigningKey,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        RoleClaimType = ClaimTypes.Role,
        NameClaimType = "name",
    };
    o.Events = new JwtBearerEvents
    {
        OnChallenge = ctx =>
        {
            ctx.HandleResponse();
            return ApiProblems.WriteAsync(ctx.HttpContext, 401, "UNAUTHORIZED", "Sessão inválida ou expirada.");
        },
        OnForbidden = ctx => ApiProblems.WriteAsync(ctx.HttpContext, 403, "FORBIDDEN", "Você não tem permissão para esta ação."),
    };
});
builder.Services.AddAuthorization();

// ----- CORS -----
var origins = config.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials().WithExposedHeaders("Location")));

// ----- Rate limiting (auth, operações sensíveis, cotações anônimas e webhooks) -----
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = (ctx, _) => new ValueTask(ApiProblems.WriteAsync(ctx.HttpContext, 429, "RATE_LIMITED", "Muitas tentativas. Aguarde um instante."));
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ClientIp(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    // Partição pelo id do usuário (claim sub), nunca pelo nome: nomes repetem e são editáveis.
    o.AddPolicy("sensitive", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? ClientIp(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));
    o.AddPolicy("quotes", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ClientIp(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("webhooks", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ClientIp(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 300, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

static string ClientIp(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "anon";

// ----- Cache de saída para catálogo (CDN-friendly) -----
builder.Services.AddOutputCache(o =>
{
    o.AddPolicy("catalog", p => p.Expire(TimeSpan.FromSeconds(60)).SetVaryByQuery("*").Tag(OutputCatalogCache.Tag));
});

builder.Services.AddExceptionHandler<ApiProblems.ExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

var app = builder.Build();

// ----- Inicialização do banco (migrations/EnsureCreated + seed) -----
using (var scope = app.Services.CreateScope())
{
    var dbOptions = scope.ServiceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
    if (dbOptions.InitializeOnStartup)
        await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync(CancellationToken.None);
}

app.UseExceptionHandler(_ => { });
// 404/405/415 sem corpo viram problem+json como todo o resto da API.
app.UseStatusCodePages(ctx => ApiProblems.WriteStatusAsync(ctx.HttpContext));
app.UseForwardedHeaders();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseOutputCache();

// OpenAPI/Scalar: sempre em Development; em produção só com OpenApi:Enabled=true.
if (app.Environment.IsDevelopment() || config.GetValue<bool>("OpenApi:Enabled"))
{
    app.MapOpenApi();
    app.MapScalarApiReference(o => o.WithTitle("Marketplace PY API"));
}
app.MapHealthChecks("/health");

var paymentOptions = app.Services.GetRequiredService<IOptions<PaymentOptions>>().Value;
var fakeGateway = paymentOptions.Provider.Equals(FakePaymentGateway.GatewayName, StringComparison.OrdinalIgnoreCase);

var api = app.MapGroup("/api");
api.MapCatalog();
api.MapSellers();
api.MapShipping();
api.MapCheckoutAndOrders();
api.MapPayments(allowSimulation: app.Environment.IsDevelopment() && fakeGateway);
api.MapWebhooks();
api.MapAuth();
api.MapAccount();
api.MapPrivacy();
api.MapMedia();
api.MapSellerPanel();
api.MapAdmin();

app.Run();

public partial class Program;
