namespace Marketplace.Infrastructure.Persistence;

public sealed class DatabaseOptions
{
    /// <summary>"Postgres" quando ConnectionStrings:Postgres existe; senão "Sqlite".</summary>
    public string Provider { get; set; } = "Sqlite";
    public string? PostgresConnectionString { get; set; }
    public string SqlitePath { get; set; } = Path.Combine(".data", "marketplace.dev.db");
    /// <summary>Aplica migrations (Postgres) / EnsureCreated (SQLite) e roda o seed na inicialização.</summary>
    public bool InitializeOnStartup { get; set; } = true;
    /// <summary>Cria usuário demo e pedidos de exemplo (somente ambientes de desenvolvimento/teste).</summary>
    public bool SeedDemoData { get; set; }
}
