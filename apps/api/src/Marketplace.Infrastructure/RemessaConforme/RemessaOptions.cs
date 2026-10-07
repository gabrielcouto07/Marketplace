namespace Marketplace.Infrastructure.RemessaConforme;

/// <summary>Seção <c>RemessaConforme</c> do appsettings (variáveis de ambiente: <c>RemessaConforme__Platform__Document</c> etc.).</summary>
public sealed class RemessaConformeOptions
{
    public PlatformIdentityOptions Platform { get; set; } = new();
    public CarrierOptions Carrier { get; set; } = new();
    /// <summary>Intervalo do RemessaJob (repasse de tributos, cancelamentos e sincronização com o Siscomex).</summary>
    public int JobIntervalMinutes { get; set; } = 10;
}

/// <summary>Empresa de comércio eletrônico (ECE) que vai na etiqueta e no bloco "remessaConforme" da DIR.</summary>
public sealed class PlatformIdentityOptions
{
    public string Brand { get; set; } = "Paraguai Já";
    public string TradeName { get; set; } = "Paraguai Já";
    /// <summary>Razão social (obrigatória fora do sandbox).</summary>
    public string LegalName { get; set; } = string.Empty;
    /// <summary>"CNPJ" (empresa nacional) ou "TIN" (estrangeira, com representante no Brasil).</summary>
    public string DocumentType { get; set; } = "CNPJ";
    public string Document { get; set; } = string.Empty;
    public string Country { get; set; } = "BR";
    public string AddressLine { get; set; } = string.Empty;
    /// <summary>Número do Ato Declaratório Executivo de certificação (sai na etiqueta).</summary>
    public string AdeNumber { get; set; } = string.Empty;
    /// <summary>Operador logístico contratado (codigoOND/nomeOND da DIR), quando houver intermediária.</summary>
    public string OperatorCode { get; set; } = string.Empty;
    public string OperatorName { get; set; } = string.Empty;
}

/// <summary>Operador logístico (Correios ou courier) que recebe a declaração, emite a etiqueta e recebe o repasse.</summary>
public sealed class CarrierOptions
{
    /// <summary>"Sandbox" (padrão: sem rede, etiqueta de teste) ou "Http" (contrato de integração v1, ver docs).</summary>
    public string Provider { get; set; } = "Sandbox";
    /// <summary>Sandbox fora de Development só com esta chave ligada (as etiquetas não valem para postagem).</summary>
    public bool AllowSandboxOutsideDevelopment { get; set; }
    public string BaseUrl { get; set; } = string.Empty;
    /// <summary>A chave de API entregue pelo operador. É a única coisa que falta para sair do sandbox.</summary>
    public string ApiKey { get; set; } = string.Empty;
    /// <summary>Cabeçalho que leva a chave ("Authorization" com esquema "Bearer", ou "X-API-Key" sem esquema).</summary>
    public string ApiKeyHeader { get; set; } = "Authorization";
    public string ApiKeyScheme { get; set; } = "Bearer";
    public string ShipmentsPath { get; set; } = "/v1/remessas";
    /// <summary>Cancelamento: {reference} é substituído pela referência devolvida na criação.</summary>
    public string CancelPathTemplate { get; set; } = "/v1/remessas/{reference}";
    public string RemittancesPath { get; set; } = "/v1/tributos/repasses";
    /// <summary>Nome da transportadora quando o operador não informar.</summary>
    public string CarrierName { get; set; } = "Operador logístico";
    public int TimeoutSeconds { get; set; } = 25;
}

/// <summary>
/// Portal Único Siscomex — API de Remessas Internacionais (remx), perfil EMPRCOMEL. Autenticação por par de chaves de
/// acesso gerado no Portal (POST /portal/api/autenticar/chave-acesso com Client-Id, Client-Secret e Role-Type).
/// </summary>
public sealed class SiscomexOptions
{
    /// <summary>Validação: https://val.portalunico.siscomex.gov.br · Produção: https://portalunico.siscomex.gov.br</summary>
    public string BaseUrl { get; set; } = "https://val.portalunico.siscomex.gov.br";
    public string AuthPath { get; set; } = "/portal/api/autenticar/chave-acesso";
    /// <summary>Prefixo do módulo de Remessas Internacionais (endpoints /api/ext/... da especificação remx).</summary>
    public string RemxPath { get; set; } = "/remx/api/ext";
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    /// <summary>Perfil de atuação: EMPRCOMEL (Empresa de Comércio Eletrônico).</summary>
    public string RoleType { get; set; } = "EMPRCOMEL";
    /// <summary>CNPJ da empresa (ou do representante no Brasil) usado como cnpjDeclarante na consulta da ECE.</summary>
    public string Cnpj { get; set; } = string.Empty;
    public int SyncIntervalMinutes { get; set; } = 60;
    /// <summary>Janela da consulta (a API aceita até 366 dias entre início e fim).</summary>
    public int LookbackDays { get; set; } = 45;
    public int MaxShipmentsPerQuery { get; set; } = 200;
    /// <summary>
    /// Classificação das ocorrências/divergências: chave "oc:{codOcorrencia}" ou "div:{codigoDivergencia}", valor
    /// Contrafacao | Subvaloracao | QualidadeDeclaracao | Ignorar. Sem entrada, vale a classificação por palavra-chave.
    /// </summary>
    public Dictionary<string, string> OccurrenceMap { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public int TimeoutSeconds { get; set; } = 30;
}

/// <summary>Serpro — Consulta CPF v3 (OAuth2 client credentials com Consumer Key e Consumer Secret).</summary>
public sealed class SerproOptions
{
    public string BaseUrl { get; set; } = "https://gateway.apiserpro.serpro.gov.br";
    public string TokenPath { get; set; } = "/token";
    public string CpfPath { get; set; } = "/consulta-cpf-df/v3/cpf/{cpf}";
    public string ConsumerKey { get; set; } = string.Empty;
    public string ConsumerSecret { get; set; } = string.Empty;
    public int CacheHours { get; set; } = 24;
    public int TimeoutSeconds { get; set; } = 10;
}

/// <summary>Tabela NCM oficial do Siscomex (pública, sem chave).</summary>
public sealed class NcmOptions
{
    /// <summary>"Siscomex" (baixa e guarda em cache) ou "Offline" (só confere formato; usado nos testes).</summary>
    public string Source { get; set; } = "Siscomex";
    public string Url { get; set; } = "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO";
    public string CachePath { get; set; } = ".data/ncm.json";
    public int RefreshHours { get; set; } = 24;
}

/// <summary>Câmbio USD→BRL oficial (PTAX do Banco Central, sem chave) para a faixa de US$ 50 e o valor em dólar da DIR.</summary>
public sealed class PtaxOptions
{
    /// <summary>"bcb-ptax" (padrão) ou "None" (só a taxa cadastrada pelo admin).</summary>
    public string Provider { get; set; } = "bcb-ptax";
    public string BaseUrl { get; set; } = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata";
    public int RefreshIntervalMinutes { get; set; } = 180;
    /// <summary>Validade da cotação gravada (cobre fim de semana e feriado).</summary>
    public int ValidityHours { get; set; } = 96;
}
