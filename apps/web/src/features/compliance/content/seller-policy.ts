/**
 * Texto oficial da Política de Admissão e de Monitoramento de Vendedores (em português, como aprovado pela empresa).
 * O preâmbulo e o item 10.1 levam os dados da empresa e a data de aprovação, que vêm de `GET /policies/seller`
 * (configurações da plataforma); o restante é fixo. Alterar o texto exige nova versão da Política em Configurações,
 * para que os vendedores sejam comunicados e aceitem de novo (itens 2.2 e 10.3).
 */

export interface PolicyItem {
  letter: string;
  text: string;
}

export interface PolicyClause {
  id: string;
  text: string;
  items?: PolicyItem[];
}

export interface PolicySection {
  number: number;
  title: string;
  clauses: PolicyClause[];
}

export const SELLER_POLICY_TITLE = "POLÍTICA DE ADMISSÃO E DE MONITORAMENTO DE VENDEDORES";

/** Preâmbulo: `{company}` e `{platform}` são substituídos pelos dados configurados. */
export const SELLER_POLICY_PREAMBLE =
  "A {company} (“EMPRESA”) emite a presente Política de Admissão e de Monitoramento de Vendedores (“POLÍTICA”), aplicável aos vendedores cadastrados em {platform} (“PLATAFORMA”).";

/** Item 10.1: `{date}` é a data de aprovação configurada. */
export const SELLER_POLICY_APPROVAL =
  "Esta Política foi aprovada pela Diretoria ou pelo sócio administrador da EMPRESA em {date} e entra em vigor nessa data.";

export const SELLER_POLICY_SECTIONS: PolicySection[] = [
  {
    number: 1,
    title: "DEFINIÇÕES",
    clauses: [
      {
        id: "1.1",
        text: "Para os fins desta Política, considera-se:",
        items: [
          { letter: "a", text: "“VENDEDOR”: a pessoa jurídica estabelecida no Paraguai, cadastrada na Plataforma para ofertar produtos;" },
          { letter: "b", text: "“REMESSA”: a remessa internacional de produto vendido na Plataforma a comprador no Brasil;" },
          { letter: "c", text: "“PRC”: o Programa Remessa Conforme, da Secretaria Especial da Receita Federal do Brasil;" },
          { letter: "d", text: "“INFRAÇÃO”: o descumprimento, pelo Vendedor, desta Política ou da legislação aplicável." },
        ],
      },
    ],
  },
  {
    number: 2,
    title: "ALCANCE E ANUÊNCIA",
    clauses: [
      { id: "2.1", text: "A EMPRESA mantém esta Política para a admissão e o monitoramento dos Vendedores." },
      {
        id: "2.2",
        text: "O cadastro na Plataforma depende da anuência do Vendedor a esta Política, manifestada por aceite eletrônico de seu representante legal, com registro de data, hora e identificação de quem aceitou.",
      },
      { id: "2.3", text: "A EMPRESA apresentará esta Política ao Vendedor antes do cadastro." },
      { id: "2.4", text: "A EMPRESA manterá esta Política disponível na Plataforma." },
      {
        id: "2.5",
        text: "A EMPRESA implantará os procedimentos previstos nesta Política antes de protocolar o requerimento de certificação no PRC.",
      },
    ],
  },
  {
    number: 3,
    title: "ADMISSÃO",
    clauses: [
      {
        id: "3.1",
        text: "Para o cadastro, o Vendedor informará:",
        items: [
          { letter: "a", text: "denominação social;" },
          { letter: "b", text: "endereço;" },
          { letter: "c", text: "telefone e endereço eletrônico;" },
          { letter: "d", text: "número de inscrição no Registro Único de Contribuyentes (RUC) do Paraguai; e" },
          { letter: "e", text: "conta bancária, carteira digital ou outro meio de pagamento associado." },
        ],
      },
      {
        id: "3.2",
        text: "O Vendedor apresentará:",
        items: [
          { letter: "a", text: "atos constitutivos e registro comercial;" },
          {
            letter: "b",
            text: "Constancia de RUC e Certificado de Cumplimiento Tributario, emitidos pela autoridade tributária do Paraguai; e",
          },
          { letter: "c", text: "cópia de documento oficial de identificação com foto do representante legal." },
        ],
      },
      {
        id: "3.3",
        text: "A EMPRESA verificará e validará os dados e documentos do cadastro antes de liberar a oferta de produtos pelo Vendedor.",
      },
      { id: "3.4", text: "A EMPRESA recusará o cadastro cujos dados ou documentos não forem validados." },
      {
        id: "3.5",
        text: "A EMPRESA recusará novo cadastro de Vendedor excluído da Plataforma, conferida a identidade do requerente pelos dados e documentos dos itens 3.1 e 3.2.",
      },
      {
        id: "3.6",
        text: "A EMPRESA manterá, para cada Vendedor, registro que vincule o cadastro aos anúncios, aos pedidos e às Remessas.",
      },
    ],
  },
  {
    number: 4,
    title: "OBRIGAÇÕES DO VENDEDOR",
    clauses: [
      { id: "4.1", text: "O Vendedor prestará à EMPRESA informações e documentos verdadeiros, corretos e atualizados." },
      { id: "4.2", text: "O Vendedor atualizará seus dados cadastrais sempre que houver alteração." },
      { id: "4.3", text: "O Vendedor confirmará seus dados cadastrais a cada 12 meses." },
      {
        id: "4.4",
        text: "O Vendedor informará, em cada anúncio, o preço efetivamente cobrado e descrição que corresponda ao produto enviado.",
      },
      { id: "4.5", text: "O Vendedor cumprirá a legislação aplicável à venda e à remessa de seus produtos ao Brasil." },
      {
        id: "4.6",
        text: "O Vendedor apresentará, quando solicitado pela EMPRESA, documentos que comprovem o valor da operação, inclusive documentos fiscais.",
      },
      { id: "4.7", text: "O Vendedor manterá registros de suas operações na Plataforma." },
      { id: "4.8", text: "O Vendedor apresentará esses registros à EMPRESA em auditoria." },
      { id: "4.9", text: "O Vendedor aplicará na Remessa a etiqueta gerada pela EMPRESA, sem alterá-la." },
      { id: "4.10", text: "O Vendedor não encaminhará produto vendido na Plataforma por meio diverso do indicado pela EMPRESA." },
    ],
  },
  {
    number: 5,
    title: "ANÚNCIOS E PRODUTOS DE OFERTA PROIBIDA",
    clauses: [
      { id: "5.1", text: "É vedada a oferta, na Plataforma, dos produtos relacionados no Anexo I." },
      {
        id: "5.2",
        text: "A EMPRESA verificará os anúncios antes da publicação e enquanto estiverem publicados, para identificar produto de oferta vedada, de origem ilícita ou contrafeito.",
      },
      { id: "5.3", text: "A EMPRESA removerá o anúncio de produto de origem ilícita ou relacionado no Anexo I." },
    ],
  },
  {
    number: 6,
    title: "PREVENÇÃO À CONTRAFAÇÃO",
    clauses: [
      {
        id: "6.1",
        text: "O Vendedor não ofertará produto de origem ilícita, contrafeito ou que infrinja direito de propriedade intelectual.",
      },
      {
        id: "6.2",
        text: "O Vendedor apresentará, quando solicitado pela EMPRESA, documentos que comprovem a autenticidade do produto, como a fatura de aquisição do fabricante ou de distribuidor autorizado, ou a autorização do titular da marca.",
      },
      { id: "6.3", text: "A EMPRESA removerá o anúncio de produto contrafeito ou que infrinja direito de propriedade intelectual." },
      {
        id: "6.4",
        text: "A EMPRESA manterá, em página da Plataforma acessível a qualquer pessoa, cadastrada ou não, canal específico para receber notificações de oferta de produto de origem ilícita ou que infrinja direito de propriedade intelectual.",
      },
      { id: "6.5", text: "A EMPRESA decidirá sobre a notificação em até 2 dias úteis, contados do recebimento." },
      { id: "6.6", text: "A EMPRESA registrará, por Vendedor, as ocorrências de produto contrafeito apuradas nas Remessas." },
      { id: "6.7", text: "A oferta de produto contrafeito é Infração e sujeita o Vendedor às medidas do item 8.1." },
      { id: "6.8", text: "A EMPRESA registrará as ações adotadas contra a venda de produtos ilegais e os seus resultados." },
    ],
  },
  {
    number: 7,
    title: "MONITORAMENTO E AUDITORIA",
    clauses: [
      { id: "7.1", text: "A EMPRESA monitorará as operações dos Vendedores na Plataforma." },
      { id: "7.2", text: "A EMPRESA registrará, por Vendedor, as inconformidades apuradas nas Remessas e a sua reincidência." },
      {
        id: "7.3",
        text: "A EMPRESA monitorará padrões anômalos de Remessas, entre eles:",
        items: [
          { letter: "a", text: "aumento abrupto do número de Remessas do Vendedor;" },
          { letter: "b", text: "concentração de Remessas para o mesmo destinatário ou endereço;" },
          { letter: "c", text: "pedidos sucessivos que indiquem fracionamento de uma mesma compra;" },
          { letter: "d", text: "preço anunciado muito inferior ao de produto equivalente na Plataforma; e" },
          { letter: "e", text: "divergência reiterada entre o produto anunciado e o produto enviado." },
        ],
      },
      {
        id: "7.4",
        text: "A EMPRESA auditará, a cada 12 meses, a conformidade com esta Política e com a legislação aplicável dos Vendedores com Infração registrada no período e de amostra dos demais.",
      },
    ],
  },
  {
    number: 8,
    title: "MEDIDAS APLICÁVEIS AO VENDEDOR",
    clauses: [
      {
        id: "8.1",
        text: "A Infração sujeita o Vendedor a:",
        items: [
          { letter: "a", text: "remoção de anúncios;" },
          { letter: "b", text: "suspensão temporária; e" },
          { letter: "c", text: "suspensão permanente, com exclusão da Plataforma." },
        ],
      },
      {
        id: "8.2",
        text: "A EMPRESA graduará a medida pela gravidade da Infração, pelo número de Infrações e pela intenção do Vendedor.",
      },
      { id: "8.3", text: "Considera-se reincidente o Vendedor que cometer nova Infração nos 12 meses seguintes à anterior." },
      {
        id: "8.4",
        text: "A EMPRESA suspenderá o Vendedor que não corrigir dados cadastrais inexatos, incompletos ou desatualizados em 10 dias, contados da solicitação da EMPRESA.",
      },
      { id: "8.5", text: "A EMPRESA comunicará ao Vendedor a remoção do anúncio ou a medida aplicada, com o motivo." },
      {
        id: "8.6",
        text: "O Vendedor poderá responder à comunicação em 10 dias, contados do recebimento, com os documentos que tiver.",
      },
    ],
  },
  {
    number: 9,
    title: "COOPERAÇÃO COM AUTORIDADES E DADOS PESSOAIS",
    clauses: [
      {
        id: "9.1",
        text: "A EMPRESA fornecerá às autoridades competentes as informações relevantes para a identificação dos responsáveis pela venda de produtos ilegais, incluídos os dados cadastrais e o histórico de transações do Vendedor.",
      },
      { id: "9.2", text: "O Vendedor declara-se ciente do fornecimento previsto no item 9.1." },
      {
        id: "9.3",
        text: "A EMPRESA tratará os dados pessoais colhidos no cadastro e no monitoramento somente para as finalidades desta Política.",
      },
      { id: "9.4", text: "A EMPRESA adotará medidas de segurança para proteger esses dados." },
    ],
  },
  {
    number: 10,
    title: "APROVAÇÃO, VIGÊNCIA E REVISÃO",
    clauses: [
      { id: "10.1", text: SELLER_POLICY_APPROVAL },
      {
        id: "10.2",
        text: "A Política será revista quando houver alteração das normas aplicáveis ou por decisão da Diretoria ou do sócio administrador.",
      },
      { id: "10.3", text: "A EMPRESA comunicará aos Vendedores as alterações desta Política." },
    ],
  },
];

export const SELLER_POLICY_ANNEX_TITLE = "ANEXO I – PRODUTOS DE OFERTA VEDADA";

export const SELLER_POLICY_ANNEX_INTRO = "É vedada a oferta, na Plataforma, de:";

export const SELLER_POLICY_ANNEX: PolicyItem[] = [
  { letter: "a", text: "armas de fogo, suas peças, munições, explosivos e agentes de guerra química;" },
  { letter: "b", text: "brinquedos, réplicas e simulacros de armas de fogo que com elas se possam confundir;" },
  { letter: "c", text: "substâncias entorpecentes ou drogas afins;" },
  { letter: "d", text: "cigarro eletrônico;" },
  { letter: "e", text: "cigarros, fumo e produtos de tabacaria;" },
  { letter: "f", text: "bebidas alcoólicas;" },
  {
    letter: "g",
    text: "produtos cuja importação dependa de autorização de órgão de controle sanitário, metrológico, de segurança pública ou ambiental, sem essa autorização;",
  },
  {
    letter: "h",
    text: "animais e vegetais da vida silvestre, espécies ameaçadas de extinção e seus derivados, e animal morto;",
  },
  { letter: "i", text: "bens usados ou recondicionados;" },
  { letter: "j", text: "diamantes;" },
  { letter: "k", text: "dinheiro em espécie;" },
  { letter: "l", text: "substâncias perecíveis, como alimentos de origem animal e frutas;" },
  {
    letter: "m",
    text: "resíduos e rejeitos sólidos perigosos, poluentes orgânicos persistentes e produtos que destroem a camada de ozônio;",
  },
  { letter: "n", text: "mercadorias atentatórias à moral, aos bons costumes, à saúde ou à ordem pública;" },
  { letter: "o", text: "produtos contrafeitos ou que infrinjam direito de propriedade intelectual; e" },
  { letter: "p", text: "bens cujo transporte seja proibido pelos Correios." },
];
