using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Marketplace.Api.Infrastructure;
using Marketplace.Application.Abstractions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Marketplace.Tests.Integration;

/// <summary>API completa com SQLite temporário, seed demo, gateway fake e CEP sem rede.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"mktpy-test-{Guid.NewGuid():N}.db");
    private readonly string _keysPath = Path.Combine(Path.GetTempPath(), $"mktpy-keys-{Guid.NewGuid():N}");

    public static readonly JsonSerializerOptions Json = JsonSetup.Create();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("Database:SqlitePath", _dbPath);
        builder.UseSetting("Database:SeedDemoData", "true");
        builder.UseSetting("DataProtection:KeysPath", _keysPath);
        builder.UseSetting("Payments:Provider", "Fake");
        builder.UseSetting("Payments:Fake:AutoApproveAfterSeconds", "0");
        builder.UseSetting("Tracking:Provider", "None");
        // Sem rede nos testes: tabela NCM só por formato e câmbio USD do seed.
        builder.UseSetting("Ncm:Source", "Offline");
        builder.UseSetting("Ptax:Provider", "None");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IPostalCodeLookup>();
            services.AddSingleton<IPostalCodeLookup, FakePostalCodeLookup>();
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { File.Delete(_dbPath); } catch { /* arquivo pode estar em uso */ }
        try { Directory.Delete(_keysPath, true); } catch { /* ignore */ }
    }

    public async Task<HttpClient> LoginAsync(string email = "demo@mktpy.com", string password = "123456")
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password }, Json);
        response.EnsureSuccessStatusCode();
        var session = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.GetProperty("accessToken").GetString());
        return client;
    }

    private sealed class FakePostalCodeLookup : IPostalCodeLookup
    {
        public Task<PostalCodeInfo?> LookupAsync(string postalCode, CancellationToken ct) =>
            Task.FromResult<PostalCodeInfo?>(postalCode == "00000000"
                ? null
                : new PostalCodeInfo(postalCode, "Avenida Paulista", "Bela Vista", "São Paulo", "SP"));
    }
}

internal static class ServiceCollectionExtensions
{
    public static void RemoveAll<T>(this IServiceCollection services)
    {
        foreach (var d in services.Where(s => s.ServiceType == typeof(T)).ToList()) services.Remove(d);
    }
}
