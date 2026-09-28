namespace Marketplace.Domain;

/// <summary>
/// Ciclo de vida do pedido (nomes em pt-BR serializados como string, iguais ao contrato do front).
/// AguardandoPagamento → Pago → EmPreparacao → Enviado → EmTransitoInternacional → Entregue → Concluido
/// Ramificações: Cancelado (até EmPreparacao); EmDisputa → Devolvido → Reembolsado.
/// </summary>
public enum OrderStatus
{
    AguardandoPagamento,
    Pago,
    EmPreparacao,
    Enviado,
    EmTransitoInternacional,
    Entregue,
    Concluido,
    Cancelado,
    EmDisputa,
    Devolvido,
    Reembolsado,
}

public enum PaymentStatus
{
    Pendente,
    Aprovado,
    Recusado,
    Expirado,
    Estornado,
}

public enum PaymentMethod
{
    Pix,
    Boleto,
    Cartao,
}

public enum UserRole
{
    Comprador,
    Vendedor,
    Admin,
}

public enum PayoutStatus
{
    Agendado,
    Processando,
    Pago,
    Falhou,
}

public enum SellerStatus
{
    Pendente,
    Aprovado,
    Suspenso,
}

public enum ProductStatus
{
    Rascunho,
    Ativo,
    Arquivado,
}

public enum ConsentType
{
    TermosDeUso,
    PoliticaDePrivacidade,
    Marketing,
}

public enum ImportTaxMode
{
    /// <summary>Alíquota única sobre produtos + frete (padrão: 60%).</summary>
    Flat,
    /// <summary>Remessa Conforme: 20% até US$ 50; 60% acima com dedução de US$ 20; + ICMS.</summary>
    RemessaConforme,
}

public enum BannerTone
{
    blue,
    red,
    neutral,
}
