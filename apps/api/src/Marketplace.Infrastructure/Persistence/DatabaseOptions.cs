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
    /// <summary>
    /// SQLite não usa migrations: quando as entidades mudam, o arquivo antigo fica sem as colunas novas e a API quebra
    /// com "no such column". Com true (padrão), o banco de dev é apagado e recriado (o seed roda de novo); com false,
    /// a inicialização falha com uma mensagem clara pedindo para apagar o arquivo.
    /// </summary>
    public bool RecreateSqliteOnSchemaChange { get; set; } = true;
    /// <summary>
    /// Fora de Development a API exige ConnectionStrings:Postgres: cair em SQLite por uma variável esquecida é
    /// perder os dados no próximo deploy. Ligue só em homologação descartável.
    /// </summary>
    public bool AllowSqliteOutsideDevelopment { get; set; }
}
