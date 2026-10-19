# Remessa Conforme — implementação, integrações e operação

Este documento cobre tudo o que o marketplace faz para cumprir o Programa Remessa Conforme (PRC) da Receita Federal:
o que cada exigência pede, onde ela está no código, como o cálculo dos tributos funciona, como a remessa sai da loja
até o despacho, o que já funciona sem credencial e **qual chave falta** para cada integração com o governo e com o
operador logístico.

**Situação em 19/10/2026.** Todas as exigências técnicas estão implementadas e testadas, incluindo o Programa de
Conformidade Tributária e Aduaneira e a Política de Admissão e de Monitoramento de Vendedores (seção 9), conferidos
cláusula a cláusula com o texto aprovado em 12/10/2026 (o texto publicado da Política é idêntico ao aprovado). O que funciona sem chave já está ligado: a tabela NCM oficial (Siscomex) e a cotação PTAX
(Banco Central). Operador logístico, Siscomex e Serpro rodam em sandbox ou desligados até receberem as credenciais da
seção 5. O selo **não aparece** no site até a empresa receber o Ato Declaratório Executivo (ADE) da Coana: a Portaria
Coana 130/2023 (art. 13) só permite o selo à empresa certificada, e não há modo de simulação.

Base legal:

| Norma | O que define |
| --- | --- |
| MP 1.357/2026 e Portaria MF 1.342/2026 | Imposto de Importação de 0% até US$ 50 e de 60% com dedução de US$ 30 acima (até US$ 3.000) para empresas do PRC. As faixas ficam em **Configurações** porque mudam por portaria (a regra anterior, da Portaria MF 1.086/2024, era 20% e US$ 20) |
| Portaria Coana 130/2023, art. 8º | Requisitos para a empresa de comércio eletrônico (ECE) ser certificada: incisos I a V abaixo |
| Portaria Coana 193/2026 | Monitoramento por três indicadores (contrafação, subvaloração, qualidade da declaração), faixas Ouro/Prata/Bronze/Advertência/Exclusão, ciclo de julho a junho e selo em dezembro para quem passa de 100 mil remessas |
| LC 214/2025 | IBS (estadual e municipal) e CBS sobre importações; as alíquotas ficam configuráveis no admin |

---

## 1. Exigências e onde estão no código

| # | Exigência | Como foi atendida | Onde |
| --- | --- | --- | --- |
| 1 | **Declaração antecipada** da remessa (art. 8º, I): dados da DIR enviados ao operador antes do despacho | Ao gerar a etiqueta, a plataforma monta a declaração no layout da DIR (remetente com RUC, destinatário com CPF, mercadorias com NCM, valor aduaneiro em BRL e USD, bloco `remessaConforme` com II, ICMS, IBS estadual, IBS municipal e CBS provisionados, `codigoECE` e `codigoOND`) e registra no operador. O pedido não segue sem NCM em todos os itens, CPF válido do destinatário e endereço de origem da loja | `Application/Services/RemessaService.cs` (`CreateAsync`, `BuildRequestAsync`), `Infrastructure/RemessaConforme/CarrierGateways.cs` (`ToPayload`) |
| 2 | **Informação clara ao comprador** (art. 8º, II; Programa 4.1 e 4.2): tributos discriminados, valor total e aviso de produto importado | Página de produto, carrinho, checkout e pedido mostram produtos, frete (ou "incluído no preço"), seguro, outras despesas, desconto, valor aduaneiro (com o equivalente em US$), II (com a alíquota e a dedução), ICMS (com a UF), IBS, CBS, total a pagar e câmbio vigente. Aviso de produto proveniente do exterior, sujeito a declaração de importação e à tributação federal e estadual | `Domain/ImportTaxCalculator.cs`, `apps/web/src/components/shared/tax-breakdown.tsx` |
| 3 | **Etiqueta com a identidade da plataforma** (art. 8º, III): marca, nome comercial e CNPJ/TIN | Etiqueta 10×15 cm gerada pela plataforma; o CNPJ (ou TIN) fica sempre na faixa do topo e, depois da certificação, o número do ADE entra ao lado dele, sem substituí-lo. Code 128 do rastreio S10, destinatário (CPF mascarado), remetente com RUC e a declaração resumida. O vendedor não digita rastreio: só confirma a postagem da etiqueta emitida (`RequirePlatformLabel`, ligado por padrão) | `Infrastructure/RemessaConforme/LabelPdf.cs`, `apps/web/src/features/seller-panel/components/order-shipment-actions.tsx` |
| 4 | **Tributos cobrados na compra e repassados** (art. 8º, IV) | No modo Remessa Conforme o valor é definitivo e entra no total pago. Cada remessa gera um `TaxRemittance` (II, ICMS, IBS e CBS) que o job envia ao operador e acompanha até a confirmação | `Domain/Entities/Commerce.cs` (`TaxRemittance`), `Infrastructure/RemessaConforme/RemessaJobs.cs` |
| 5 | **Admissão de vendedores** (art. 8º, V; Política 2 e 3) | Cadastro da loja exige denominação social, endereço, telefone, e-mail, RUC, meio de recebimento, representante legal e os quatro documentos da Política 3.2 (privados), além do aceite eletrônico da Política. A loja nasce *Pendente* e só vende depois que a equipe confere os 9 itens; trocar dados de identificação exige nova verificação | `Application/Services/SellerPanelService.cs`, `AdminService.VerifySellerAsync`, `apps/web/src/features/seller-panel/components/verification-section.tsx` |
| 6 | **Monitoramento de vendedores** (art. 8º, V) | Produtos com marca protegida no nome ou preço abaixo de 40% da mediana do mesmo NCM vão para análise antes da vitrine; compradores denunciam produtos; denúncia procedente vira infração da loja (Política 6.7), julgada pela equipe, e não entra nos indicadores da Receita; ocorrências da Receita (Siscomex, despacho, ouvidoria, comunicações registradas pela equipe) são acompanhadas por loja e, com 3 em 365 dias, abrem alerta para a equipe. Nenhuma medida é automática: suspensão e exclusão são graduadas pela equipe (8.2), comunicadas com o motivo e com 10 dias para resposta (8.5 e 8.6), e a exclusão exige a infração que a motiva | `Application/Services/ComplianceService.cs`, `apps/web/src/features/admin/components/admin-compliance.tsx` |
| 7 | **NCM correto** em cada mercadoria (qualidade da declaração) | NCM de 8 dígitos obrigatório para publicar, conferido na tabela oficial do Siscomex; posições do Anexo I da Política (armas, tabaco, bebidas alcoólicas, medicamentos, usados, perecíveis…) e incoerência com a categoria são recusadas; natureza, marca, material, quantidade e país de origem completam a descrição | `Domain/Compliance/Compliance.cs` (`Ncm`), `Infrastructure/Gov/SiscomexNcmCatalog.cs`, `apps/web/src/features/seller-panel/components/ncm-field.tsx` |
| 8 | **CPF do destinatário** (qualidade da declaração; Programa 7.2) | Obrigatório e validado em cada endereço; o checkout confere número e nome do titular no Serpro antes de concluir a venda. Fora de Development, sem a chave a venda não conclui | `AccountService`, `CheckoutService`, `Infrastructure/Gov/SerproTaxpayerRegistry.cs` |
| 9 | **Indicadores da Portaria Coana 193/2026** | Painel com os três indicadores no ciclo e mês a mês, faixa e consequência de cada um, contagem para o selo (100 mil remessas), acompanhamento por loja (ocorrências da Receita, infrações em 12 meses, reincidência e alerta aberto), fila de denúncias, produtos em análise e lojas a verificar. Contestação de ocorrência só por erro material, falha de sistema ou duplicidade | `ComplianceService.DashboardAsync`, `/admin/conformidade` |
| — | **Selo no site** | Selo no header (faixa de departamentos no desktop, faixa sob a busca no celular), na página de produto, no checkout e no rodapé, com a medalha da faixa do ciclo. Só com `NEXT_PUBLIC_REMESSA_CONFORME=true` **e** o número do ADE; antes disso nenhuma página (nem o styleguide `/design`) mostra o selo, e a página `/remessa-conforme` usa um ícone neutro | `apps/web/src/components/shared/trust-badge.tsx`, `apps/web/src/lib/env.ts` |

Prints de cada item estão no relatório publicado para esta entrega.

---

## 2. Tributos

Uma compra com produtos de várias lojas vira um pedido por loja, e **cada pedido é uma remessa** com declaração
própria. Por isso os tributos são calculados por remessa e somados no resumo do checkout. O desconto de cupom é
rateado pelo subtotal de cada remessa (a última absorve o arredondamento).

### Fórmulas (modo `RemessaConforme`)

```
valor aduaneiro (VA) = produtos + frete + seguro + outras despesas − desconto
VA em US$            = VA ÷ cotação PTAX (USD→BRL)
II                   = VA × faixa baixa (0%)                       se VA ≤ US$ 50
                     = VA × faixa alta (60%) − (US$ 30 × cotação)  se VA > US$ 50   (até US$ 3.000)
base                 = VA + II
ICMS ("por dentro")  = base ÷ (1 − alíquota da UF) − base
IBS estadual         = base × alíquota IBS estadual
IBS municipal        = base × alíquota IBS municipal
CBS                  = base × alíquota CBS
total de tributos    = II + ICMS + IBS + CBS
total da remessa     = VA + total de tributos
```

Regras de arredondamento: valores em centavos (`long`), multiplicação por pontos-base com arredondamento meio-para-cima
e câmbio como fração exata (`numerator/denominator`). Acima de US$ 3.000 a remessa sai do regime simplificado
(`exceedsSimplifiedLimit`). No modo `Flat` (legado) aplica-se uma alíquota única, mostrada como estimativa.

Exemplo real (bicicleta ergométrica de R$ 899,00, frete grátis, entrega em SP, PTAX de R$ 5,40):

| Linha | Valor |
| --- | --- |
| Valor aduaneiro | R$ 899,00 (≈ US$ 166,48, acima de US$ 50) |
| II: 60% − US$ 30 | R$ 539,40 − R$ 162,00 = **R$ 377,40** |
| ICMS 17% (SP), por dentro | (899,00 + 377,40) ÷ 0,83 − 1.276,40 = **R$ 261,43** |
| IBS e CBS | R$ 0,00 (alíquotas em 0 até a consultoria confirmar) |
| **Total de tributos** | **R$ 638,83**, cobrado na compra |

Até US$ 50 o II é zero e só o ICMS (e IBS/CBS, quando houver alíquota) entra: um produto de R$ 99,00 com R$ 24,90 de
frete para SP paga R$ 30,45 de ICMS e nada de II.

### Configuração (admin › Configurações)

| Campo | Padrão | Observação |
| --- | --- | --- |
| Modo | `RemessaConforme` | a migration `RemessaConforme` muda bancos existentes de `Flat` para este modo |
| II até US$ 50 | 0% | `importDutyLowTierBasisPoints` (Portaria MF 1.342/2026) |
| II acima de US$ 50 | 60% | `importDutyHighTierBasisPoints` |
| Dedução acima de US$ 50 | US$ 30 | `importDutyHighTierDeductionUsdCents`; a migration `FaixasImpostoImportacao` grava 0%, 60% e US$ 30 nos bancos existentes |
| ICMS padrão | 17% | `icmsBasisPoints` |
| ICMS por estado | vazio | ex.: `SP=2000; RJ=2000` (pontos-base); vale a UF do endereço de entrega |
| IBS estadual, IBS municipal, CBS | 0% | LC 214/2025: preencher com as alíquotas vigentes |
| Seguro | 0% | sobre o valor dos produtos; a linha aparece zerada |
| Outras despesas por remessa | R$ 0,00 | valor fixo somado ao valor aduaneiro |

Pontos de entrada: `GET /taxes/estimate?amount=&state=` (página de produto e carrinho, sem frete),
`POST /checkout/quotes` (por remessa, com frete e desconto) e o `taxes` gravado em cada pedido.

---

## 3. Fluxo da remessa

```
compra paga ──► vendedor: "Gerar etiqueta" ──► plataforma valida a declaração (NCM, CPF, origem, identidade)
                                                │
                                                ▼
                          operador registra a declaração antecipada e devolve rastreio S10 + etiqueta PDF
                                                │  pedido → Em preparação; TaxRemittance criado
                                                ▼
         vendedor imprime, cola e posta ──► "Confirmar postagem" ──► pedido Enviado (rastreio da etiqueta)
                                                │
              ┌─────────────────────────────────┼──────────────────────────────────┐
              ▼                                 ▼                                  ▼
   RemessaJob: repassa os tributos   SiscomexSyncJob: DIR, situação,     rastreio: valor majorado, apreensão por
   ao operador e acompanha           ocorrências e divergências          contrafação e erro de declaração
                                                └──────────────► ocorrências ◄─────────────────┘
                                                                     │
                                                    indicadores + acompanhamento da loja
```

- `POST /seller/orders/{id}/shipment` gera a etiqueta; `GET …/shipment/label` baixa o PDF (o admin baixa por
  `GET /admin/shipments/{id}/label`). Remessas do sandbox sem o arquivo guardado (ex.: dados de demonstração) recebem
  uma segunda via gerada na hora.
- `POST /seller/orders/{id}/ship` confirma a postagem. Sem etiqueta da plataforma a API devolve `409 LABEL_REQUIRED`;
  só com **Envio só com etiqueta da plataforma** desligado o vendedor informa transportadora e rastreio (botão
  "Informar envio"). O painel lê `GET /seller/shipping-policy` (`requirePlatformLabel`, `carrierConfigured`, `sandbox`)
  para mostrar "Gerar etiqueta", "Informar envio" ou o aviso de etiqueta indisponível.
- Falha no operador deixa a remessa em `Falhou` com o motivo; o admin reenvia em **Remessas**.
- `RemessaJob` roda a cada `RemessaConforme:JobIntervalMinutes` (10 min); `SiscomexSyncJob`, a cada
  `Siscomex:SyncIntervalMinutes` (60 min), olhando os últimos `LookbackDays` (45).

### Ocorrências e indicadores

| Origem | Como entra |
| --- | --- |
| Siscomex | ocorrências e divergências da consulta de remessas da ECE, classificadas por `Siscomex:OccurrenceMap` (`oc:<código>` ou `div:<código>` → indicador ou `Ignorar`) ou por palavra-chave (contrafação/falsificação → Contrafação; valor declarado/arbitramento → Subvaloração; CPF, NCM, descrição, remetente → Qualidade da declaração) |
| Rastreio (despacho) | eventos normalizados `CUSTOMS_VALUE_ADJUSTED` (Subvaloração), `SEIZED_COUNTERFEIT` (Contrafação) e `DECLARATION_ERROR` (Qualidade da declaração) |
| Equipe | registro manual, com código, descrição, data e pedido, do que a Receita informar (ouvidoria, comunicação da Coana) |

Denúncia procedente **não** é ocorrência: é julgada pela equipe e vira infração da loja (Política 6.7), com a remoção do
anúncio quando cabível. A API recusa registrar ocorrência com origem `Denuncia`, e registros antigos com essa origem ficam
fora dos indicadores, das listas e do acompanhamento.

Indicador = remessas sem ocorrência ÷ remessas movimentadas (pedidos que passaram por *Enviado*), por mês e no ciclo
(julho a junho). Faixas: Ouro ≥ 99,7% · Prata ≥ 99,4% · Bronze ≥ 99,0% · Advertência ≥ 98,0% · Exclusão abaixo.
Ocorrência anulada não conta; contestada continua contando até ser anulada.

> Na demonstração há só 7 remessas no ciclo, então uma ocorrência derruba o indicador para 85,71% (Exclusão). Com
> volume real, a mesma ocorrência pesa 0,001% em 100 mil remessas.

---

## 4. Vendedores e produtos

- **Admissão**: `legalAddress`, `responsibleName`, `responsibleDocumentType` (`CedulaPy` 5–9 dígitos, `Cpf` com
  dígito verificador, `Passaporte` 6–12 letras/dígitos), `responsibleDocument` (volta mascarado), `identityDocumentUrl`
  e `rucCertificateUrl`. O admin aprova (`POST /admin/sellers/{id}/verify`, `approve: true`) ou recusa com motivo
  (a loja fica suspensa e o vendedor vê o motivo). Suspender uma loja exige motivo.
- **Publicação**: NCM obrigatório e descrição com 40+ caracteres para ir à vitrine. Marca protegida no nome
  (lista editável no admin) ou preço abaixo de `PriceFloorPercent`% da mediana do mesmo NCM (mín. 3 produtos; senão a
  posição de 4 dígitos) → **Em análise**. O admin aprova (libera aquele nome e preço; subir o preço ou baixá-lo em até 10%
  não volta à análise), bloqueia com motivo ou põe em análise (`POST /admin/products/{id}/moderate`).
- **Denúncias**: `POST /products/{id}/reports` (comprador logado; uma aberta por produto e pessoa). Julgamento em
  `POST /admin/reports/{id}/resolve` (`upheld`, `blockProduct`, `note`): procedente registra a infração da loja.
- **Acompanhamento por loja**: `SellerStrikeLimit` (3) ocorrências da Receita em `StrikeWindowDays` (365) abrem um alerta
  de monitoramento `OcorrenciasReceita` para a equipe (um por loja; ocorrências novas atualizam o alerta aberto). Nada é
  suspenso ou excluído sozinho: a equipe registra a infração, vê a medida sugerida pela gravidade, pelo número de
  infrações e pela intenção (Política 8.2) e decide. Toda medida é comunicada com o motivo e prazo de 10 dias para
  resposta (8.5 e 8.6). A exclusão só sai de `POST /admin/sellers/{id}/measures` com a infração que a motiva
  (`infractionId`); a edição da loja não aceita o status `Excluido`. A única suspensão automática é a da Política 8.4
  (dados cadastrais não corrigidos em 10 dias).

---

## 5. Integrações: o que já funciona e qual chave falta

O painel **Admin › Integrações** (`GET /admin/integrations`) mostra o mesmo quadro ao vivo, com a variável que falta em
cada uma. Variáveis no formato do .NET (`Seção__Chave`), definidas no serviço `api`.

| Integração | Sem chave | Para produção | Onde obter |
| --- | --- | --- | --- |
| **Tabela NCM oficial** (Siscomex, pública) | ✅ ativa: baixa a nomenclatura vigente (10.516 códigos em 05/10/2026) a cada 24 h, com cache em `.data/ncm.json` | nada | — |
| **PTAX** (Banco Central, pública) | ✅ ativa: cotação de venda USD→BRL a cada 3 h, usada na faixa de US$ 50 e no valor em dólar da declaração | nada | — |
| **Identidade da empresa (ECE)** | etiqueta sai com marca e nome comercial; CNPJ "não configurado" | `RemessaConforme__Platform__LegalName`, `RemessaConforme__Platform__Document` (CNPJ, só dígitos), `RemessaConforme__Platform__AdeNumber`; opcionais: `__DocumentType` (`CNPJ` ou `TIN`), `__AddressLine`, `__OperatorCode` e `__OperatorName` (codigoOND quando houver intermediária) | contrato social e o ADE publicado pela Coana |
| **Operador logístico** (Correios, courier ou intermediária) | **sandbox** em Development: rastreio `SB…PY`, declaração `SBX-…`, etiqueta "SANDBOX · NÃO POSTAR", repasse confirmado na hora. Fora de Development fica desligado (sem etiqueta, sem envio) | `RemessaConforme__Carrier__Provider=Http`, `RemessaConforme__Carrier__BaseUrl`, `RemessaConforme__Carrier__ApiKey`; opcionais: `__ApiKeyHeader` (`Authorization`), `__ApiKeyScheme` (`Bearer`), `__ShipmentsPath`, `__CancelPathTemplate`, `__RemittancesPath`, `__CarrierName`, `__TimeoutSeconds` | contrato com o operador; ele implementa o **contrato v1** abaixo ou a plataforma escreve um adaptador |
| **Portal Único Siscomex — Remessas Internacionais** | desligado | `Siscomex__ClientId`, `Siscomex__ClientSecret`, `Siscomex__Cnpj`; para produção, `Siscomex__BaseUrl=https://portalunico.siscomex.gov.br` (o padrão é o ambiente de validação `val.`) | Portal Único › chave de acesso do perfil **EMPRCOMEL** (representante da ECE) |
| **Serpro — Consulta CPF** | só o dígito verificador do CPF é conferido | `Serpro__ConsumerKey`, `Serpro__ConsumerSecret` | loja Serpro (API Consulta CPF v3), contrato da empresa |
| **Selo no site** (build do `web`) | desligado: nenhuma página mostra o selo | depois do ADE: `NEXT_PUBLIC_REMESSA_CONFORME=true`, `NEXT_PUBLIC_REMESSA_CONFORME_ADE=<número>`; em dezembro, se houver selo: `NEXT_PUBLIC_REMESSA_CONFORME_SELO=ouro\|prata\|bronze` e `NEXT_PUBLIC_REMESSA_CONFORME_CICLO=2026/2027` | o ADE e o resultado do ciclo publicados pela Coana |

> A Portaria Coana 130/2023 (art. 13) só permite o selo à empresa certificada. Sem o número do ADE o selo continua
> desligado mesmo com `true` (o painel de integrações mostra "Falta o número do ADE"); o antigo valor `simulacao` agora
> equivale a desligado.

### 5.1 Portal Único Siscomex (perfil EMPRCOMEL)

1. `POST {BaseUrl}/portal/api/autenticar/chave-acesso` com os headers `Client-Id`, `Client-Secret` e
   `Role-Type: EMPRCOMEL`. A resposta traz `Set-Token` e `X-CSRF-Token`, válidos por 60 min (o cliente renova antes de
   vencer).
2. `POST {BaseUrl}/remx/api/ext/consulta-remessas-ece` com o CNPJ da ECE e o período → número de protocolo.
3. `GET {BaseUrl}/remx/api/ext/consulta-remessas-ece/{protocolo}` → remessas com DIR, situação, ocorrências e
   divergências. A situação (Manifestada, Em fiscalização, Desembaraçada, Em perdimento…) aparece em **Remessas**.

Implementação: `Infrastructure/Gov/PortalUnicoSiscomexClient.cs` + `Application/Services/SiscomexSyncService.cs`.

### 5.2 Serpro — Consulta CPF v3

`POST {BaseUrl}/token` (client credentials com `ConsumerKey:ConsumerSecret`) e
`GET {BaseUrl}/consulta-cpf-df/v3/cpf/{cpf}`. Situação *cancelada* ou *nula* bloqueia o endereço e o checkout, e o
nome do titular precisa conferir com o nome do destinatário (Programa 7.2). Resultado em cache por `Serpro:CacheHours`
(24 h). Fora de Development, sem chave ou com o serviço fora do ar, a venda **não conclui** (503
`CPF_VERIFICATION_UNAVAILABLE`); `Serpro__AllowUnverifiedOutsideDevelopment=true` libera só o dígito verificador
(demonstração).

### 5.3 Operador logístico — contrato de integração v1

Autenticação: `Authorization: Bearer <ApiKey>` (ou o header e esquema configurados). Toda requisição de escrita leva
`Idempotency-Key`.

**Criar remessa** — `POST {BaseUrl}/v1/remessas`

```json
{
  "versao": "1",
  "idRemessa": "3f0c…",
  "pedido": "PY-2026-100201",
  "servico": "ECONOMICO",
  "transportadoraSugerida": "Correo Paraguayo + Correios",
  "etiqueta": { "marca": "Mercado Paraguai", "nomeComercial": "Mercado Paraguai", "razaoSocial": "…", "tipoDocumento": "CNPJ", "documento": "…", "ade": "…" },
  "remessa": {
    "descricao": "Smartphone 6.1\" 128 GB dual chip 4G",
    "destinacaoComercial": "n",
    "frete": 0.00, "moedaFrete": "BRL", "freteModoPagto": "PREPAID",
    "peso": 0.42, "volumes": 1, "dimensoes": { "comprimentoCm": 18, "larguraCm": 10, "alturaCm": 6 },
    "remetente": { "nome": "TecnoCentro CDE", "tipoDocumento": "5", "documento": "80012345-0", "endereco": { "logradouro": "Av. Monseñor Rodríguez 120, Microcentro", "cidade": "Ciudad del Este", "cep": "7000", "pais": "PY" } },
    "destinatario": { "nome": "Gabriel Demo", "tipoDocumento": "1", "documento": "52998224725", "endereco": { "logradouro": "Avenida Paulista, 1578 – Apto 42 – Bela Vista", "cidade": "São Paulo", "uf": "SP", "cep": "01310100", "pais": "BR" }, "telefone": "11987654321", "email": "demo@mktpy.com" },
    "mercadorias": [ { "sequencia": "1", "codElementoNcm": "85171300", "descricao": "Smartphone 6.1\" 128 GB dual chip 4G", "quantidade": 1, "valor": 999.00, "valorUnitario": 999.00, "moeda": "BRL", "peso": 0.42, "paisOrigem": "PY" } ],
    "remessaConforme": { "codigoECE": "<CNPJ>", "nomeECE": "<razão social>", "codigoOND": "", "nomeOND": "", "dataCompra": "2026-10-05T15:00:00.000", "valorProvII": 437.40, "valorProvICMS": 294.20, "valorProvIBSEstadual": 0.00, "valorProvIBSMunicipal": 0.00, "valorProvCBS": 0.00 }
  },
  "valores": { "produtos": 999.00, "frete": 0.00, "seguro": 0.00, "desconto": 0.00, "valorAduaneiro": 999.00, "valorAduaneiroUsd": 185.00, "cambioUsdBrl": "US$ 1,00 = R$ 5,40", "regime": "RemessaConforme", "totalTributos": 731.60 }
}
```

Tipos de documento da DIR: `1` CPF, `2` CNPJ, `3` passaporte, `5` TIN (o RUC paraguaio é o TIN do remetente).

Resposta `200/201`:

```json
{ "referencia": "op-123", "numeroRemessa": "LB123456785PY", "transportadora": "Correios", "numeroDeclaracao": "…", "etiquetaPdfBase64": "JVBERi0x…", "etiquetaUrl": null }
```

`numeroRemessa` e `referencia` são obrigatórios, e a etiqueta vem em `etiquetaPdfBase64` ou `etiquetaUrl`. Erro 400,
409 ou 422 vira "O operador recusou a remessa: <mensagem do corpo>" para o vendedor; outros erros ou timeout deixam a
remessa em `Falhou`, e o admin reenvia em **Remessas**.

**Cancelar** — `DELETE {BaseUrl}/v1/remessas/{referencia}` (404 é tratado como já cancelada).

**Repassar tributos** — `POST {BaseUrl}/v1/tributos/repasses`

```json
{ "versao": "1", "idRepasse": "…", "pedido": "PY-2026-100201", "numeroRemessa": "LB123456785PY", "referencia": "op-123", "dataPagamento": "2026-10-05T15:02:11.000", "valorII": 437.40, "valorICMS": 294.20, "valorIBSEstadual": 0.00, "valorIBSMunicipal": 0.00, "valorCBS": 0.00, "valorTotal": 731.60, "moeda": "BRL" }
```

Resposta: `{ "referencia": "rep-987", "confirmado": true }`. Sem confirmação, o job tenta de novo (até 8 vezes);
depois o repasse aparece *com falha* em **Remessas**.

---

## 6. Telas

| Quem | Onde | O que tem |
| --- | --- | --- |
| Comprador | página de produto | aviso de importado (4.1); a conta inteira com frete do CEP, total a pagar e câmbio (4.2); marca, modelo e país de fabricação; "Denunciar produto" sem login |
| Qualquer pessoa | `/denuncia` e `/politica-de-vendedores` | canal de denúncias com protocolo e prazo; texto integral da Política |
| Comprador | pedido | comprovante em PDF (pagamento e valor da compra) |
| Comprador | carrinho | impostos estimados com II, ICMS, IBS e CBS |
| Comprador | checkout | valor aduaneiro (com US$), tributos definitivos por remessa, câmbio e faixa; endereço sem CPF bloqueia o pagamento e abre o formulário para completar |
| Comprador | pedido | os mesmos valores gravados na compra e o rastreio S10 |
| Comprador | `/remessa-conforme` | como funcionam os impostos, exemplo calculado com a cotação do dia e as regras para as lojas |
| Vendedor | produtos | campo NCM com a descrição da tabela oficial; declaração (natureza, marca/sem marca, modelo, material, unidades, país de origem) com prévia; aviso de produto em análise ou bloqueado |
| Vendedor | cadastro | texto da Política, aceite e declaração de representante legal |
| Vendedor | comunicações | medidas, pedidos de documentos e correções, com prazo de 10 dias e resposta com anexos |
| Vendedor | painel | avisos de suspensão/exclusão, nova versão da Política, confirmação anual e comunicações abertas |
| Vendedor | pedidos | Gerar etiqueta → Baixar etiqueta → Confirmar postagem |
| Vendedor | configurações | dados da empresa, recebimento, representante legal e os quatro documentos; confirmação anual dos dados |
| Admin | Conformidade | painel do Programa (pendências e prazos), indicadores, apuração mensal, selo do ciclo e ocorrências; abas Receita Federal, Monitoramento, Comunicações, Capacitação, Registro de ações e Auditorias |
| Admin | Denúncias | protocolo, canal, prazo de 2 dias úteis, titular do direito e evidências; julgar (procedente com indicador, infração e remoção, ou improcedente) |
| Admin | Remessas | rastreio, declaração, DIR, situação aduaneira, repasse, conferências da remessa, etiqueta e reenvio |
| Admin | Integrações | o quadro da seção 5 |
| Admin | Produtos / Vendedores | moderação; conferência do cadastro (9 itens); comunicações, infrações, medidas graduadas, aceites, auditorias e dossiê |
| Admin | Configurações | tributos (ICMS por UF, IBS, CBS, seguro, despesas), regras de conformidade, responsável pelo Programa, datas de aprovação, versão da Política e limites do monitoramento |

Depois da certificação, o selo no header fica na faixa de departamentos (desktop) para não estreitar a busca: só o
emblema no `md`, emblema + "Remessa Conforme" + medalha a partir do `lg`. No celular, faixa sob a busca na home.

---

## 7. Banco, mock e testes

- Migration `20261005144637_RemessaConforme`: tabelas `shipments`, `shipment_labels`, `tax_remittances`,
  `compliance_occurrences`, `product_reports`; colunas de KYC em `sellers`, moderação em `products`, CPF do destinatário em
  `addresses` e `orders`, `tax_breakdown` em `orders`; novos campos em `platform_settings`. Bancos
  existentes passam ao modo `RemessaConforme` e recebem a lista padrão de marcas protegidas.
- Seed de demonstração (API e mock iguais): remessas com rastreio `LB…PY`, declaração, DIR e repasse confirmado; duas
  ocorrências; duas denúncias abertas; um produto em análise por preço; a loja *Eletro Ponte Import* aguardando
  verificação.
- Migration `20261009182542_ProgramaConformidade`: dados de admissão e aceite em `sellers`; declaração em `products` e
  nos itens do pedido; `seller_policy_acceptances`, `seller_notices`, `seller_infractions`, `seller_measures`,
  `monitoring_alerts`, `rf_interactions`, `compliance_trainings`, `enforcement_actions`, `order_documents` e
  `seller_audits`; conferências em `shipments`; protocolo, canal e prazo em `product_reports`; contestação em
  `compliance_occurrences`; Programa e limites em `platform_settings`. Os padrões preenchem as linhas existentes.
- Mock (MSW): `src/mocks/fixtures/remessa.ts` reproduz a calculadora, a tabela NCM (recorte), o Anexo I, as faixas e o S10;
  `src/mocks/governance.ts` e `src/mocks/handlers/governance.ts` reproduzem o Programa e a Política (comunicações,
  medidas, monitoramento, Receita, capacitação, auditoria, comprovante e dossiê). O banco do mock mudou para
  `mktpy.mockdb.v5` (v5: faixas do II nas configurações).
- Testes: `Unit/RemessaConformeTests.cs` (calculadora, NCM, faixas, S10, Code 128, marcas) e
  `Integration/RemessaConformeFlowTests.cs` (etiqueta e postagem, NCM e marca protegida, denúncia procedente como
  infração fora dos indicadores, alerta de acompanhamento sem suspensão automática, verificação de loja, CPF do destinatário, integrações, política de envio do vendedor e segunda via da etiqueta);
  `Unit/ComplianceProgramTests.cs` e `Integration/ComplianceProgramFlowTests.cs` (Anexo I, declaração, nome do titular do
  CPF, fracionamento, graduação das medidas, prazos, comprovante, canal público, aceite, comunicações, loja suspensa fora
  do checkout e prazo da correção cadastral); `Integration/StrictCpfCheckoutTests.cs` (Consulta CPF obrigatória: resposta
  sem o nome do titular não conclui a venda).

## 8. Antes de ligar em produção

1. Receber o ADE da Coana e configurar a identidade da empresa (seção 5).
2. Contratar o operador logístico e configurar `RemessaConforme__Carrier__*` (ou adaptar o contrato v1).
3. Gerar a chave de acesso EMPRCOMEL no Portal Único e configurar `Siscomex__*` no ambiente de validação; depois trocar
   `Siscomex__BaseUrl` para produção.
4. Contratar o Serpro Consulta CPF e configurar `Serpro__*` (sem a chave, fora de Development, nenhuma venda conclui).
5. Confirmar com a consultoria tributária as alíquotas de ICMS por UF, IBS e CBS e ajustar em **Configurações**.
6. Ligar o selo no build do `web`: `NEXT_PUBLIC_REMESSA_CONFORME=true` e `NEXT_PUBLIC_REMESSA_CONFORME_ADE=<número>`.
7. Concluir as pendências da seção 9.4 (contrato com os Correios, responsável e datas de aprovação, capacitação).
---

## 9. Programa de Conformidade Tributária e Aduaneira e Política de Vendedores

Os dois documentos da empresa (o **Programa** e a **Política de Admissão e de Monitoramento de Vendedores**, com o
Anexo I) estão implementados item a item. O texto integral da Política é publicado em `/politica-de-vendedores`
(`apps/web/src/features/compliance/content/seller-policy.ts`); a razão social, o documento, a sede e a data de aprovação
vêm da configuração. Os dados pessoais do Responsável pelo Programa (CPF, RG, endereço) **não** ficam no código nem no
banco: só nome e e-mail, em **Configurações**.

### 9.1 Programa de Conformidade

| Item | Exigência | Como foi atendida | Onde |
| --- | --- | --- | --- |
| 2.4, 3 | Responsável pelo Programa e relacionamento com a Receita | Nome, e-mail e datas de aprovação em Configurações; painel do Programa com as pendências e prazos; registro de toda interação com a Receita (consulta mensal, plano de ação, notificação, ouvidoria, contestação, manifestação, comunicação de fato) | `ComplianceProgramService.ProgramAsync`, `ReceitaRelationsService`, `/admin/conformidade`, `/admin/conformidade/receita` |
| 3.6 | Comunicar à Receita fato que comprometa o PRC | Tipo "Comunicação de fato" no registro da Receita | `RfInteractionType.ComunicacaoDeFato` |
| 4.1 | Página do produto informa que ele vem do exterior, será importado, é objeto de declaração e está sujeito à tributação federal e estadual | Aviso fixo no topo do bloco de tributos | `ImportedProductNotice` (`tax-breakdown.tsx`), chaves `taxes.importedTitle/importedHint` |
| 4.2 | Na mesma página: produto, frete e seguro (ou "incluído no preço"), descontos, despesas, II, ICMS, IBS, CBS, total a pagar e câmbio vigente | A página do produto mostra a conta inteira, na ordem do item; o frete entra quando o comprador informa o CEP (`/taxes/estimate?freight=`) e aparece como "Incluído no preço do produto" no frete grátis; a linha de descontos aparece sempre (zerada quando não há) e a promoção "de/por" do anúncio entra nela (produto pelo preço "de", desconto pela diferença; o valor aduaneiro não muda); total a pagar e câmbio com a data da cotação | `product-view.tsx`, `TaxBreakdown` (`freightIncluded`, `freightPending`, `listingDiscount`, `showTotal`), `ImportTaxService.EstimateAsync` |
| 5 | Contrato com os Correios; declaração antecipada; repasse dos tributos | Declaração e repasse já implementados (seção 3); o **contrato** é da empresa (ver 9.4) | `RemessaService`, `RemessaJobs` |
| 6.1, 6.3 | Subfaturamento, fracionamento e ocultação de remetente; valor declarado = valor cobrado | Antes de registrar a remessa, conferências gravadas com a remessa (remetente, destinatário, mercadorias, regime, valor); diferença entre declarado e cobrado bloqueia (`DECLARED_VALUE_MISMATCH`) | `RemessaService.PrepareAsync`, `Shipment.ChecksJson`, admin › Remessas (link "conferências") |
| 6.2 | Valor declarado = produto + frete + seguro | Valor aduaneiro da calculadora | `ImportTaxCalculator` |
| 6.4, 6.5 | Fracionamento: mesmo comprador e endereço em 7 dias mudando a faixa de US$ 50 ou passando de US$ 3.000 | Conferido no checkout e no monitoramento; alerta para a equipe; da mesma loja, retém a etiqueta (`MONITORING_HOLD`) até o julgamento; procedente e atribuído ao vendedor vira infração | `Fractioning`, `MonitoringService`, `/admin/conformidade/monitoramento` |
| 7.1, 7.3 | Dados do remetente, destinatário e bens; remetente correto e completo | Remetente = denominação social + RUC + endereço de origem da loja verificada | `RemessaService.PrepareAsync`, `Seller.SenderName` |
| 7.2 | CPF do destinatário conferido na Receita (número e nome do titular) antes de concluir a venda | Checkout consulta o Serpro e compara o nome do titular com o nome do destinatário; resposta sem o nome do titular conta como não conferida; fora de Development, sem chave do Serpro a venda **não conclui** (503 `CPF_VERIFICATION_UNAVAILABLE`), salvo `Serpro__AllowUnverifiedOutsideDevelopment=true` (demonstração). Com operador real, a etiqueta só sai de pedido conferido na Receita (o "sandbox" da demonstração não vale) | `CheckoutService`, `PersonName.Matches`, `CpfVerificationOptions`, `RemessaService.PrepareAsync` |
| 7.4 | Descrição com natureza, marca e modelo (quando houver), material e quantidade, sem termos genéricos | Campos obrigatórios para publicar; termos genéricos recusados; prévia do texto da declaração no formulário; texto congelado no item do pedido | `DeclarationText`, `declaration-section.tsx`, `OrderItem.DeclarationDescription` |
| 7.5 | Não informar conteúdo diverso do vendido | A declaração sai dos itens do pedido (snapshot), nunca de texto livre | `RemessaService` |
| 7.6 | Regime, classificação fiscal e origem | Regime e limite de US$ 3.000 conferidos; NCM oficial; país de origem (ISO) obrigatório | `PrepareAsync`, `Countries` |
| 8.1–8.4 | Contrafação: verificar anúncios antes e depois da publicação; remover; exigir documentos de autenticidade | Anexo I por NCM (bloqueio) e por termos (análise) na publicação e na rotina a cada 6 h; marca protegida e preço muito abaixo vão para análise; pedido de documentos de autenticidade com prazo de 10 dias; não comprovado remove o anúncio | `ProhibitedGoods`, `ComplianceService.ScreenPublishedListingsAsync`, `SellerGovernanceService` |
| 8.5 | Canal específico para notificações | `/denuncia` (público, sem login) e botão na página do produto, com protocolo | `ComplianceEndpoints.MapCompliancePublic`, `public-report-view.tsx` |
| 8.6 | Suspender quem oferta contrafeito | Denúncia procedente = infração; a equipe aplica a medida graduada (8.2) na ficha da loja | `ComplianceService.ResolveReportAsync`, `MeasureGuide` |
| 8.7 | Acompanhar o indicador de contrafação e ocorrências por vendedor | Painel de indicadores e ocorrências por loja | `/admin/conformidade` |
| 8.8 | Informações às autoridades | Dossiê da loja (JSON) com cadastro, aceites, anúncios, pedidos, remessas, ocorrências e medidas; cada exportação fica registrada | `ComplianceProgramService.SellerDossierAsync`, admin › Vendedores › Dossiê |
| 8.9 | Registrar ações contra contrafeitos e resultados | Registro automático de cada decisão | `EnforcementAction`, `/admin/conformidade/acoes` |
| 9.1, 9.2 | Etiqueta com marca, nome comercial e CNPJ/TIN, em PT/ES/EN | Etiqueta da plataforma | `LabelPdf.cs` |
| 9.3, 9.4 | Selo do PRC ou "PROGRAMA REMESSA CONFORME" em caixa alta e negrito | Texto em negrito na faixa da etiqueta; o número do ADE, quando configurado, entra ao lado e o CNPJ/TIN continua na etiqueta | `LabelPdf.cs`, `mocks/pdf.ts` |
| 9.5 | Iniciada a operação, nada fora do fluxo | Com o ADE configurado a etiqueta da plataforma não pode ser desligada; o admin não marca "Enviado" sem etiqueta (`LABEL_REQUIRED`) | `AdminService.UpdateSettingsAsync`, `AdminService.TransitionOrderAsync` |
| 10.1–10.3 | Registros por pedido, com vendedor, remessa, comprovante de pagamento e do valor | Comprovante em PDF gerado na aprovação do pagamento e guardado com o pedido; download pelo comprador, pela loja e pelo admin | `ReceiptService`, `OrderDocument`, `GET /orders/{id}/receipt` |
| 10.4 | Conservar por 5 anos | Exclusão de conta anonimiza o comprador, mas os registros do pedido ficam 5 anos; a limpeza diária só apaga o que passou do prazo | `PrivacyService.RetentionEnds`, `PurgeExpiredRecordsAsync` |
| 11.2 | Consulta mensal dos indicadores | Registro da consulta do mês com os indicadores oficiais; pendência no painel até ser registrada | `RfInteractionType.ConsultaMensal` |
| 11.3 | Faixas e medidas | Textos das faixas iguais aos do Programa; Bronze e Advertência pedem plano de ação | `ComplianceBands.Consequence`, `RequiresActionPlan` |
| 11.4, 11.5 | Plano de ação e saneamento em 30 dias | Registros com prazo de 30 dias e alerta de vencimento | `ProgramDeadlines` |
| 11.6, 11.7 | Contestação só por erro material, inconsistência sistêmica ou impropriedade na metodologia, com indicador, remessas, fundamentação e evidências | Formulário de contestação (na ocorrência ou na tela da Receita); a decisão da Receita anula ou confirma as ocorrências | `ReceitaRelationsService.ContestAsync` |
| 11.8 | Manifestação anual de 1º a 31 de outubro | Janela no painel e registro próprio | `AnnualManifestationWindow` |
| 12 | Ouvidoria: prazo da Receita ou 5 dias úteis | Registro com prazo calculado em dias úteis | `AddBusinessDays` |
| 13.1 | Capacitação no início da função e a cada 12 meses | Registro por pessoa, com vencimento; administradores entram na lista sozinhos | `/admin/conformidade/capacitacao` |

### 9.2 Política de Admissão e de Monitoramento de Vendedores

| Item | Exigência | Como foi atendida | Onde |
| --- | --- | --- | --- |
| 1.1 a | Vendedor = pessoa jurídica estabelecida no Paraguai | RUC paraguaio com dígito verificador, país de origem fixo `PY`, atos constitutivos e registro comercial obrigatórios; a conferência da equipe tem os itens "RUC de pessoa jurídica" e "pessoa jurídica estabelecida no Paraguai" | `Documents.IsValidRuc`, `Seller.Country`, `VerificationItems` |
| 2.2 | Aceite eletrônico do representante legal com data, hora e identificação | Aceite no cadastro (Política + declaração de representante) e a cada nova versão; grava versão, data/hora, nome, documento e IP | `SellerPolicyAcceptance`, `SellerPanelService.RegisterAsync/AcceptPolicyAsync` |
| 2.3, 2.4 | Política apresentada antes do cadastro e disponível na plataforma | Texto integral no cadastro da loja e em `/politica-de-vendedores` (rodapé e sitemap) | `seller-register-view.tsx`, `seller-policy-view.tsx` |
| 3.1 | Denominação social, endereço, telefone e e-mail, RUC e meio de pagamento | Campos obrigatórios no cadastro e nas configurações da loja; conta guardada criptografada e exibida mascarada | `SellerPanelService.ValidateProfileAsync`, `store-form.tsx`, `PayoutSection` |
| 3.2 | Atos constitutivos e registro comercial; Constancia de RUC e Certificado de Cumplimiento Tributario; documento com foto do representante | Quatro documentos em armazenamento **privado** (volume da API, nunca no bucket público), abertos só por link assinado de 30 min | `LocalDocumentStorage`, `DocumentLinks`, `DocumentUpload` |
| 3.3, 3.4 | Verificar antes de liberar; recusar o que não validar | Loja nasce *Pendente*; aprovação exige os 9 itens da conferência marcados; recusa suspende, registra e pede correção em 10 dias. Só loja *Aprovada* vende: vitrine, cotação do checkout e fechamento do pedido recusam loja pendente, suspensa ou excluída, inclusive pelo carrinho ou cotação de antes da medida | `AdminService.VerifySellerAsync`, `SELLER_VERIFICATION_ITEMS`, `ShippingService.ResolveLinesAsync`, `CheckoutService` |
| 3.5 | Recusar novo cadastro de loja excluída | RUC, documento do representante ou conta de recebimento de loja excluída barram o cadastro (`SELLER_EXCLUDED`); denominação, e-mail ou telefone em comum aparecem na ficha da loja para a equipe conferir | `SellerGovernanceService.MatchExcludedAsync` |
| 3.6 | Cadastro ligado a anúncios, pedidos e remessas | Chaves do banco e o dossiê | `Seller`, `Product`, `Order`, `Shipment` |
| 4.2, 4.3 | Atualizar dados; confirmar a cada 12 meses | Atualizar conta como confirmação; aviso no painel 30 dias antes do vencimento e botão "Confirmar dados"; vencido gera pedido de correção | `ConfirmDataAsync`, `DataConfirmationCard`, `RunDailyAsync` |
| 4.4, 4.9, 4.10 | Preço cobrado e descrição corretos; etiqueta da plataforma; nada fora do fluxo | Valor declarado = cobrado; etiqueta obrigatória | seções 3 e 9.1 |
| 4.6, 6.2 | Documentos de valor e de autenticidade quando pedidos | Comunicação "Pedido de documentos" com prazo de 10 dias; resposta com texto e anexos privados | `SellerNotice`, `/vendedor/comunicacoes` |
| 4.7, 4.8, 7.4 | Registros do vendedor e auditoria anual | Auditoria anual: lojas com infração no período + amostra (% configurável); pede os registros; não conforme vira infração | `ComplianceProgramService.PlanAuditsAsync`, `/admin/conformidade/auditorias` |
| 5.1–5.3, Anexo I | Produtos de oferta vedada | NCM do Anexo I bloqueia a publicação; termos e NCM sensíveis mandam para análise; anúncios publicados são reconferidos a cada 6 h. A categoria **Bebidas** saiu (bebidas alcoólicas, item f): bancos existentes têm os produtos bloqueados com medida e comunicação, a categoria desativada e a loja suspensa; entrou **Games** | `ProhibitedGoods`, `DatabaseInitializer.BackfillGovernanceAsync`, `SeedCatalog` |
| 6.4, 6.5 | Canal aberto a qualquer pessoa; decisão em 2 dias úteis | `/denuncia` e o botão do produto, sem login (rate limit e campo isca); protocolo e prazo para quem denuncia; fila com vencimento; decisão enviada por e-mail | `ComplianceService.SubmitPublicReportAsync`, `NoticeMailerJob` |
| 6.6, 6.7, 7.2 | Ocorrências por vendedor; contrafeito é infração; reincidência | Infrações com gravidade, intenção e reincidência em 12 meses; acompanhamento por loja no painel de conformidade, com alerta para a equipe (sem medida automática) | `SellerInfraction`, `SellerGovernanceService.AddInfractionAsync` |
| 7.1, 7.3 | Monitoramento e padrões anômalos | Rotina a cada 6 h: aumento abrupto (vezes a média de 8 semanas), concentração no mesmo destinatário (30 dias), fracionamento, preço muito abaixo, divergência reiterada; limites em Configurações | `MonitoringService`, `ComplianceMonitorJob` |
| 8.1–8.3 | Medidas graduadas (remoção, suspensão temporária, exclusão) | Sugestão pela gravidade, número de infrações e intenção; a equipe decide; a exclusão exige a infração que a motiva; suspensão com prazo volta sozinha | `MeasureGuide.Recommend`, `SellerGovernanceSection` |
| 8.4 | Suspender quem não corrige dados em 10 dias | Rotina diária suspende automaticamente. O pedido só se encerra com os dados corrigidos ou confirmados no cadastro (responder por escrito não para o prazo); correção recusada pela equipe mantém o prazo da solicitação original e, se ele já venceu, suspende na hora; atualizar o cadastro levanta a suspensão | `SellerGovernanceService.RunDailyAsync`, `RespondAsync`, `ResolveNoticeAsync`, `MarkDataConfirmedAsync` |
| 8.5, 8.6 | Comunicar a medida com o motivo; resposta em 10 dias | Toda medida gera comunicação (painel e e-mail) com prazo de resposta | `NoticeMailerJob`, `SellerNotices` |
| 9.1, 9.2 | Informações às autoridades | Dossiê (9.1 do Programa 8.8) e ciência no aceite | `SellerDossierAsync` |
| 9.3, 9.4 | Dados pessoais só para a Política; segurança | Documentos privados com link assinado; documento e conta criptografados; dados mascarados nas telas | `DocumentLinks`, Data Protection |
| 10.1, 10.3 | Aprovação; comunicar alterações | Data de aprovação em Configurações (aparece no item 10.1); nova versão notifica todas as lojas e exige novo aceite | `AdminService.UpdateSettingsAsync`, `SellerComplianceBanners` |

### 9.3 Rotinas

- `ComplianceMonitorJob` (`ComplianceMonitoring:IntervalMinutes`, padrão 360): reconfere anúncios (Anexo I), procura
  padrões anômalos e cuida dos prazos (confirmação anual, correção cadastral, fim de suspensões).
- `NoticeMailerJob` (1 min): envia por e-mail as comunicações gravadas para as lojas e a decisão das denúncias.
- Limpeza diária: apaga só os registros que passaram de 5 anos (Programa 10.4).

### 9.4 O que depende da empresa (fora do código)

1. **Contrato com os Correios** (Programa 5.1 a 5.4), direto ou por intermediária, com as obrigações dos itens 5.2 e 5.3.
2. **Chave do Serpro (Consulta CPF)**: sem ela, fora de Development, nenhuma venda conclui. Para demonstração em produção,
   `Serpro__AllowUnverifiedOutsideDevelopment=true` libera só o dígito verificador (não atende o item 7.2).
3. **ADE da Coana** (`RemessaConforme__Platform__AdeNumber`) e **razão social, CNPJ/TIN e sede**
   (`RemessaConforme__Platform__*`): completam a etiqueta, a declaração e o preâmbulo da Política publicada.
4. **Responsável pelo Programa e datas de aprovação** em admin › Configurações (o Programa e a Política citam a data). O
   Programa (item 1.1 f) designa Thiago Silva Barreira; no sistema ficam só o nome e o e-mail.
5. **Capacitação** de quem trabalha com as remessas, registrada em admin › Conformidade › Capacitação.
6. **Consulta mensal** dos indicadores no Portal Único, **manifestação anual** (outubro) e respostas à Receita, registradas
   em admin › Conformidade › Receita Federal.
7. **Revisão jurídica** do texto da Política publicada e da tradução (o texto oficial está em português).

