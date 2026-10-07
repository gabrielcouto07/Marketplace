# Remessa Conforme — implementação, integrações e operação

Este documento cobre tudo o que o marketplace faz para cumprir o Programa Remessa Conforme (PRC) da Receita Federal:
o que cada exigência pede, onde ela está no código, como o cálculo dos tributos funciona, como a remessa sai da loja
até o despacho, o que já funciona sem credencial e **qual chave falta** para cada integração com o governo e com o
operador logístico.

**Situação em 05/10/2026.** Todas as exigências técnicas estão implementadas e testadas (API: 123 testes; web:
typecheck e lint limpos). O que funciona sem chave já está ligado: a tabela NCM oficial (Siscomex) e a cotação PTAX
(Banco Central). Operador logístico, Siscomex e Serpro rodam em sandbox ou desligados até receberem as credenciais da
seção 5. O selo no site está em **simulação** até a empresa receber o Ato Declaratório Executivo (ADE) da Coana.

Base legal:

| Norma | O que define |
| --- | --- |
| Lei 14.902/2024 e Portaria MF 1.086/2024 | Imposto de Importação de 20% até US$ 50 e de 60% com dedução de US$ 20 acima (até US$ 3.000) |
| Portaria Coana 130/2023, art. 8º | Requisitos para a empresa de comércio eletrônico (ECE) ser certificada: incisos I a V abaixo |
| Portaria Coana 193/2026 | Monitoramento por três indicadores (contrafação, subvaloração, qualidade da declaração), faixas Ouro/Prata/Bronze/Advertência/Exclusão, ciclo de julho a junho e selo em dezembro para quem passa de 100 mil remessas |
| LC 214/2025 | IBS (estadual e municipal) e CBS sobre importações; as alíquotas ficam configuráveis no admin |

---

## 1. Exigências e onde estão no código

| # | Exigência | Como foi atendida | Onde |
| --- | --- | --- | --- |
| 1 | **Declaração antecipada** da remessa (art. 8º, I): dados da DIR enviados ao operador antes do despacho | Ao gerar a etiqueta, a plataforma monta a declaração no layout da DIR (remetente com RUC, destinatário com CPF, mercadorias com NCM, valor aduaneiro em BRL e USD, bloco `remessaConforme` com II, ICMS, IBS estadual, IBS municipal e CBS provisionados, `codigoECE` e `codigoOND`) e registra no operador. O pedido não segue sem NCM em todos os itens, CPF válido do destinatário e endereço de origem da loja | `Application/Services/RemessaService.cs` (`CreateAsync`, `BuildRequestAsync`), `Infrastructure/RemessaConforme/CarrierGateways.cs` (`ToPayload`) |
| 2 | **Informação clara ao comprador** (art. 8º, II): tributos discriminados, valor total e aviso de produto importado | Página de produto, carrinho, checkout e pedido mostram produtos, frete, seguro, outras despesas, desconto, valor aduaneiro (com o equivalente em US$), II (com a alíquota e a dedução), ICMS (com a UF), IBS, CBS, total de tributos e câmbio usado. Aviso "Produto importado do Paraguai e tributado" na página de produto | `Domain/ImportTaxCalculator.cs`, `apps/web/src/components/shared/tax-breakdown.tsx` |
| 3 | **Etiqueta com a identidade da plataforma** (art. 8º, III): marca, nome comercial e CNPJ/TIN | Etiqueta 10×15 cm gerada pela plataforma, com Code 128 do rastreio S10, destinatário (CPF mascarado), remetente com RUC e a declaração resumida. O vendedor não digita rastreio: só confirma a postagem da etiqueta emitida (`RequirePlatformLabel`, ligado por padrão) | `Infrastructure/RemessaConforme/LabelPdf.cs`, `apps/web/src/features/seller-panel/components/order-shipment-actions.tsx` |
| 4 | **Tributos cobrados na compra e repassados** (art. 8º, IV) | No modo Remessa Conforme o valor é definitivo e entra no total pago. Cada remessa gera um `TaxRemittance` (II, ICMS, IBS e CBS) que o job envia ao operador e acompanha até a confirmação | `Domain/Entities/Commerce.cs` (`TaxRemittance`), `Infrastructure/RemessaConforme/RemessaJobs.cs` |
| 5 | **Admissão de vendedores** (art. 8º, V) | Cadastro da loja exige endereço de origem, responsável, documento (cédula paraguaia, CPF ou passaporte, validados) e as imagens do documento e da constância do RUC. A loja nasce *Pendente* e só vende depois que o admin aprova os documentos; trocar documento exige nova verificação | `Application/Services/SellerPanelService.cs`, `AdminService.VerifySellerAsync`, `apps/web/src/features/seller-panel/components/verification-section.tsx` |
| 6 | **Monitoramento de vendedores** (art. 8º, V) | Produtos com marca protegida no nome ou preço abaixo de 40% da mediana do mesmo NCM vão para análise antes da vitrine; compradores denunciam produtos; ocorrências (do Siscomex, do rastreio, de denúncias procedentes ou registradas pela equipe) contam para a reincidência; com 3 ocorrências em 365 dias a loja é descredenciada sozinha | `Application/Services/ComplianceService.cs`, `apps/web/src/features/admin/components/admin-compliance.tsx` |
| 7 | **NCM correto** em cada mercadoria (qualidade da declaração) | NCM de 8 dígitos obrigatório para publicar, conferido na tabela oficial do Siscomex; capítulos proibidos em remessa (24 tabaco, 30 medicamentos, 36 explosivos, 93 armas) e incoerência com a categoria são recusados | `Domain/Compliance/Compliance.cs` (`Ncm`), `Infrastructure/Gov/SiscomexNcmCatalog.cs`, `apps/web/src/features/seller-panel/components/ncm-field.tsx` |
| 8 | **CPF do destinatário** (qualidade da declaração) | Obrigatório e validado em cada endereço; o checkout não paga sem ele (endereços antigos pedem o CPF ali mesmo). Com a chave do Serpro, CPF cancelado ou nulo é recusado | `AccountService`, `CheckoutService`, `Infrastructure/Gov/SerproTaxpayerRegistry.cs` |
| 9 | **Indicadores da Portaria Coana 193/2026** | Painel com os três indicadores no ciclo e mês a mês, faixa e consequência de cada um, contagem para o selo (100 mil remessas), lojas com ocorrências, fila de denúncias, produtos em análise e lojas a verificar. Contestação de ocorrência só por erro material, falha de sistema ou duplicidade | `ComplianceService.DashboardAsync`, `/admin/conformidade` |
| — | **Selo no site** | Selo no header (faixa de departamentos no desktop, faixa sob a busca no celular), na página de produto, no checkout e no rodapé, com a medalha da faixa do ciclo. Em `simulacao` aparece sempre com a etiqueta "Simulação" | `apps/web/src/components/shared/trust-badge.tsx`, `apps/web/src/lib/env.ts` |

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
II                   = VA × 20%                         se VA ≤ US$ 50
                     = VA × 60% − (US$ 20 × cotação)    se VA > US$ 50   (até US$ 3.000)
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
| II: 60% − US$ 20 | R$ 539,40 − R$ 108,00 = **R$ 431,40** |
| ICMS 17% (SP), por dentro | (899,00 + 431,40) ÷ 0,83 − 1.330,40 = **R$ 272,49** |
| IBS e CBS | R$ 0,00 (alíquotas em 0 até a consultoria confirmar) |
| **Total de tributos** | **R$ 703,89**, cobrado na compra |

### Configuração (admin › Configurações)

| Campo | Padrão | Observação |
| --- | --- | --- |
| Modo | `RemessaConforme` | a migration `RemessaConforme` muda bancos existentes de `Flat` para este modo |
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
                                                    indicadores + reincidência da loja
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
| Denúncia procedente | o admin escolhe o indicador e pode bloquear o produto |
| Equipe | registro manual com código, descrição, data e pedido (ouvidoria, comunicação da Coana) |

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
  `POST /admin/reports/{id}/resolve` (`upheld`, `indicator`, `blockProduct`, `note`).
- **Reincidência**: `SellerStrikeLimit` (3) ocorrências em `StrikeWindowDays` (365) suspendem a loja automaticamente,
  com o motivo registrado e auditoria `compliance.seller.suspend`.

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
| **Selo no site** (build do `web`) | `NEXT_PUBLIC_REMESSA_CONFORME=simulacao` mostra o selo com "Simulação" | depois do ADE: `NEXT_PUBLIC_REMESSA_CONFORME=true`, `NEXT_PUBLIC_REMESSA_CONFORME_ADE=<número>`; em dezembro, se houver selo: `NEXT_PUBLIC_REMESSA_CONFORME_SELO=ouro\|prata\|bronze` e `NEXT_PUBLIC_REMESSA_CONFORME_CICLO=2026/2027` | o ADE e o resultado do ciclo publicados pela Coana |

> Exibir o selo como certificado (`true`) antes do ADE é propaganda enganosa. Mantenha `simulacao` (ou desligado) até
> a publicação.

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
`GET {BaseUrl}/consulta-cpf-df/v3/cpf/{cpf}`. Situação *cancelada* ou *nula* bloqueia o endereço e o checkout; demais
situações passam. Resultado em cache por `Serpro:CacheHours` (24 h). Falha do serviço não bloqueia a compra.

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
  "etiqueta": { "marca": "Paraguai Já", "nomeComercial": "Paraguai Já", "razaoSocial": "…", "tipoDocumento": "CNPJ", "documento": "…", "ade": "…" },
  "remessa": {
    "descricao": "Smartphone 6.1\" 128 GB dual chip 4G",
    "destinacaoComercial": "n",
    "frete": 0.00, "moedaFrete": "BRL", "freteModoPagto": "PREPAID",
    "peso": 0.42, "volumes": 1, "dimensoes": { "comprimentoCm": 18, "larguraCm": 10, "alturaCm": 6 },
    "remetente": { "nome": "TecnoCentro CDE", "tipoDocumento": "5", "documento": "80012345-0", "endereco": { "logradouro": "Av. Monseñor Rodríguez 120, Microcentro", "cidade": "Ciudad del Este", "cep": "7000", "pais": "PY" } },
    "destinatario": { "nome": "Gabriel Demo", "tipoDocumento": "1", "documento": "52998224725", "endereco": { "logradouro": "Avenida Paulista, 1578 – Apto 42 – Bela Vista", "cidade": "São Paulo", "uf": "SP", "cep": "01310100", "pais": "BR" }, "telefone": "11987654321", "email": "demo@mktpy.com" },
    "mercadorias": [ { "sequencia": "1", "codElementoNcm": "85171300", "descricao": "Smartphone 6.1\" 128 GB dual chip 4G", "quantidade": 1, "valor": 999.00, "valorUnitario": 999.00, "moeda": "BRL", "peso": 0.42, "paisOrigem": "PY" } ],
    "remessaConforme": { "codigoECE": "<CNPJ>", "nomeECE": "<razão social>", "codigoOND": "", "nomeOND": "", "dataCompra": "2026-10-05T15:00:00.000", "valorProvII": 491.40, "valorProvICMS": 305.26, "valorProvIBSEstadual": 0.00, "valorProvIBSMunicipal": 0.00, "valorProvCBS": 0.00 }
  },
  "valores": { "produtos": 999.00, "frete": 0.00, "seguro": 0.00, "desconto": 0.00, "valorAduaneiro": 999.00, "valorAduaneiroUsd": 185.00, "cambioUsdBrl": "US$ 1,00 = R$ 5,40", "regime": "RemessaConforme", "totalTributos": 796.66 }
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
{ "versao": "1", "idRepasse": "…", "pedido": "PY-2026-100201", "numeroRemessa": "LB123456785PY", "referencia": "op-123", "dataPagamento": "2026-10-05T15:02:11.000", "valorII": 491.40, "valorICMS": 305.26, "valorIBSEstadual": 0.00, "valorIBSMunicipal": 0.00, "valorCBS": 0.00, "valorTotal": 796.66, "moeda": "BRL" }
```

Resposta: `{ "referencia": "rep-987", "confirmado": true }`. Sem confirmação, o job tenta de novo (até 8 vezes);
depois o repasse aparece *com falha* em **Remessas**.

---

## 6. Telas

| Quem | Onde | O que tem |
| --- | --- | --- |
| Comprador | página de produto | tributos discriminados (prévia sem frete), aviso de importado, selo, "Denunciar produto" |
| Comprador | carrinho | impostos estimados com II, ICMS, IBS e CBS |
| Comprador | checkout | valor aduaneiro (com US$), tributos definitivos por remessa, câmbio e faixa; endereço sem CPF bloqueia o pagamento e abre o formulário para completar |
| Comprador | pedido | os mesmos valores gravados na compra e o rastreio S10 |
| Comprador | `/remessa-conforme` | como funcionam os impostos, exemplo calculado com a cotação do dia e as regras para as lojas |
| Vendedor | produtos | campo NCM com a descrição da tabela oficial; aviso de produto em análise ou bloqueado |
| Vendedor | pedidos | Gerar etiqueta → Baixar etiqueta → Confirmar postagem |
| Vendedor | configurações | responsável e documentos, com a situação da verificação |
| Admin | Conformidade | indicadores, apuração mensal, selo do ciclo, filas e ocorrências (registrar, contestar, anular) |
| Admin | Denúncias | julgar (procedente com indicador e bloqueio, ou improcedente) |
| Admin | Remessas | rastreio, declaração, DIR, situação aduaneira, repasse, etiqueta e reenvio |
| Admin | Integrações | o quadro da seção 5 |
| Admin | Produtos / Vendedores | moderação e verificação de documentos |
| Admin | Configurações | tributos (ICMS por UF, IBS, CBS, seguro, despesas) e regras de conformidade |

O selo no header fica na faixa de departamentos (desktop) para não estreitar a busca: só o emblema no `md`,
emblema + "Remessa Conforme" + medalha + "Simulação" a partir do `lg`. No celular, faixa sob a busca na home.

---

## 7. Banco, mock e testes

- Migration `20261005144637_RemessaConforme`: tabelas `shipments`, `shipment_labels`, `tax_remittances`,
  `compliance_occurrences`, `product_reports`; colunas de KYC em `sellers`, moderação em `products`, CPF do destinatário em
  `addresses` e `orders`, `tax_breakdown` em `orders`; novos campos em `platform_settings`. Bancos
  existentes passam ao modo `RemessaConforme` e recebem a lista padrão de marcas protegidas.
- Seed de demonstração (API e mock iguais): remessas com rastreio `LB…PY`, declaração, DIR e repasse confirmado; duas
  ocorrências; duas denúncias abertas; um produto em análise por preço; a loja *Eletro Ponte Import* aguardando
  verificação.
- Mock (MSW): `src/mocks/fixtures/remessa.ts` reproduz a calculadora, a tabela NCM (recorte), as faixas e o S10;
  `src/mocks/handlers/remessa.ts` cobre todas as rotas acima, inclusive a etiqueta em PDF. O banco do mock mudou para
  `mktpy.mockdb.v3`.
- Testes: `Unit/RemessaConformeTests.cs` (calculadora, NCM, faixas, S10, Code 128, marcas) e
  `Integration/RemessaConformeFlowTests.cs` (etiqueta e postagem, NCM e marca protegida, denúncia procedente,
  reincidência, verificação de loja, CPF do destinatário, integrações, política de envio do vendedor e segunda via da etiqueta).

## 8. Antes de ligar em produção

1. Receber o ADE da Coana e configurar a identidade da empresa (seção 5).
2. Contratar o operador logístico e configurar `RemessaConforme__Carrier__*` (ou adaptar o contrato v1).
3. Gerar a chave de acesso EMPRCOMEL no Portal Único e configurar `Siscomex__*` no ambiente de validação; depois trocar
   `Siscomex__BaseUrl` para produção.
4. Contratar o Serpro Consulta CPF e configurar `Serpro__*`.
5. Confirmar com a consultoria tributária as alíquotas de ICMS por UF, IBS e CBS e ajustar em **Configurações**.
6. Trocar o selo de `simulacao` para `true` (e preencher o ADE) no build do `web`.
