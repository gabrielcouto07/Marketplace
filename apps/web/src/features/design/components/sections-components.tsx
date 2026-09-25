"use client";

import { Filter, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BottomNav } from "@/components/layout/bottom-nav";
import { FormField } from "@/components/shared/form-field";
import { OrderStatusBadge, OrderTimeline } from "@/components/shared/order-status";
import { PriceTag } from "@/components/shared/price-tag";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { RatingStars } from "@/components/shared/rating-stars";
import { ReputationMeter, SellerBadge } from "@/components/shared/seller-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { DeliveryWindow, GuaranteeBadge, ImportTaxLine } from "@/components/shared/trust-badge";
import { Badge } from "@/components/ui/badge";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatCep, formatCpf } from "@/lib/validation/documents";

import {
  PRODUCT_DISCOUNT,
  PRODUCT_NORMAL,
  PRODUCT_SOLD_OUT,
  SELLER,
  TIMELINE_EVENTS,
} from "./design-data";
import { Demo } from "./design-view";

/* ------------------------------------------------------------------ */
/* Botões                                                               */
/* ------------------------------------------------------------------ */

const VARIANTS = [
  { variant: "cta", label: "Comprar agora", hint: "primary-cta · um por tela" },
  { variant: "primary", label: "Continuar", hint: "primary · ações sem conotação de compra" },
  { variant: "secondary", label: "Adicionar ao carrinho", hint: "surface + borda" },
  { variant: "soft", label: "Ver loja", hint: "azul suave" },
  { variant: "ghost", label: "Cancelar", hint: "só texto" },
  { variant: "link", label: "Ver política", hint: "link" },
  { variant: "destructive", label: "Remover item", hint: "sempre com ícone" },
  { variant: "floating", label: "Sobre imagem", hint: "galeria" },
] as const;

export function ButtonsSection() {
  return (
    <div className="flex flex-col gap-4">
      <Demo
        label="Variantes × estados"
        hint="padrão · loading · disabled — todos com foco visível e toque ≥ 44 px"
      >
        <ul className="flex flex-col divide-y divide-border">
          {VARIANTS.map((v) => (
            <li
              key={v.variant}
              className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[180px_1fr] md:items-center"
            >
              <span className="flex flex-col text-caption text-foreground-muted">
                <span className="font-medium text-foreground-secondary">{v.variant}</span>
                <span>{v.hint}</span>
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant={v.variant}>
                  {v.variant === "destructive" ? <Trash2 data-icon="inline-start" /> : null}
                  {v.label}
                </Button>
                <Button variant={v.variant} loading>
                  {v.label}
                </Button>
                <Button variant={v.variant} disabled>
                  {v.label}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Demo>
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="Tamanhos" hint="lg 48/16 px · default 48/14 px · sm 40 · xs 32">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">Finalizar compra</Button>
            <Button>Continuar</Button>
            <Button size="sm">Aplicar</Button>
            <Button size="xs">Limpar</Button>
          </div>
        </Demo>
        <Demo label="Ícones" hint="44 px de toque; ícones lucide em 20/24, traço 1.75">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="icon" aria-label="Buscar">
              <Search strokeWidth={1.75} />
            </Button>
            <Button size="icon" variant="secondary" aria-label="Filtrar">
              <Filter strokeWidth={1.75} />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Adicionar">
              <Plus strokeWidth={1.75} />
            </Button>
            <Button size="icon" variant="floating" aria-label="Carrinho">
              <ShoppingCart strokeWidth={1.75} />
            </Button>
          </div>
        </Demo>
        <Demo
          label="CTA full-width no mobile"
          hint="a linha de compra: CTA vermelho + secundário ao lado"
          className="md:col-span-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" className="sm:flex-1">
              Adicionar ao carrinho
            </Button>
            <Button variant="cta" className="sm:flex-1">
              Comprar agora
            </Button>
          </div>
        </Demo>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulários                                                          */
/* ------------------------------------------------------------------ */

export function FormsSection() {
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [cepError, setCepError] = useState<string | null>(null);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Demo
        label="Inputs"
        hint="48 px · 16 px de fonte · label acima, helper abaixo · validação no blur"
      >
        <div className="flex flex-col gap-4">
          <FormField id="ds-email" label="E-mail" hint="Usamos só para avisar sobre o pedido.">
            <Input
              id="ds-email"
              type="email"
              placeholder="voce@exemplo.com"
              aria-describedby="ds-email-hint"
            />
          </FormField>
          <FormField id="ds-cpf" label="CPF" optional>
            <Input
              id="ds-cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
            />
          </FormField>
          <FormField id="ds-cep" label="CEP" error={cepError}>
            <Input
              id="ds-cep"
              inputMode="numeric"
              placeholder="00000-000"
              value={cep}
              aria-invalid={cepError ? true : undefined}
              aria-describedby={cepError ? "ds-cep-error" : undefined}
              onChange={(e) => setCep(formatCep(e.target.value))}
              onBlur={() => setCepError(cep.length === 9 ? null : "CEP incompleto. São 8 dígitos.")}
            />
          </FormField>
          <FormField id="ds-disabled" label="Desabilitado">
            <Input id="ds-disabled" disabled value="Não editável" readOnly />
          </FormField>
          <FormField id="ds-notes" label="Observações">
            <Textarea id="ds-notes" placeholder="Algo que o vendedor precise saber?" />
          </FormField>
        </div>
      </Demo>
      <Demo label="Seleção" hint="select, radio, checkbox, switch e tabs">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-sort">Ordenar por</Label>
            <Select defaultValue="relevance" items={SORT_ITEMS}>
              <SelectTrigger id="ds-sort" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RadioGroup defaultValue="pix" aria-label="Pagamento" className="gap-3">
            {[
              ["pix", "Pix", "Aprovação na hora"],
              ["card", "Cartão de crédito", "Em até 12x"],
              ["boleto", "Boleto", "Compensa em 1 dia útil"],
            ].map(([value, label, hint]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 has-data-checked:border-primary has-data-checked:bg-primary-soft/50"
              >
                <RadioGroupItem value={value} />
                <span className="flex flex-col">
                  <span className="text-body-sm font-medium text-foreground">{label}</span>
                  <span className="text-caption text-foreground-secondary">{hint}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
          <label className="flex items-center gap-3 text-body-sm text-foreground">
            <Checkbox defaultChecked /> Só com frete grátis
          </label>
          <label className="flex items-center justify-between gap-3 text-body-sm text-foreground">
            Receber ofertas por e-mail <Switch defaultChecked />
          </label>
          <Tabs defaultValue="produtos">
            <TabsList>
              <TabsTrigger value="produtos">Produtos</TabsTrigger>
              <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
              <TabsTrigger value="politicas">Políticas</TabsTrigger>
            </TabsList>
            <TabsContent value="produtos" className="text-foreground-secondary">
              Controle segmentado de largura total.
            </TabsContent>
            <TabsContent value="avaliacoes" className="text-foreground-secondary">
              Aba ativa em surface com sombra xs.
            </TabsContent>
            <TabsContent value="politicas" className="text-foreground-secondary">
              Sem transition-all: só cor.
            </TabsContent>
          </Tabs>
          <div className="flex items-center justify-between">
            <span className="text-body-sm text-foreground">Quantidade</span>
            <QuantityDemo />
          </div>
        </div>
      </Demo>
    </div>
  );
}

const SORT_ITEMS = {
  relevance: "Relevância",
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
  newest: "Novidades",
};

function QuantityDemo() {
  const [qty, setQty] = useState(1);
  return <QuantityStepper value={qty} onChange={setQty} allowRemove onRemove={() => setQty(1)} />;
}

/* ------------------------------------------------------------------ */
/* Produto e preço                                                      */
/* ------------------------------------------------------------------ */

export function CardsSection() {
  return (
    <div className="flex flex-col gap-4">
      <Demo label="ProductCard" hint="normal · com desconto · sem estoque · skeleton" bare>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <ProductCard product={PRODUCT_NORMAL} priority />
          <ProductCard product={PRODUCT_DISCOUNT} priority />
          <ProductCard product={PRODUCT_SOLD_OUT} priority />
          <ProductCardSkeleton />
        </div>
      </Demo>
      <div className="grid gap-4 md:grid-cols-3">
        <Demo label="PriceTag · sm" hint="cards">
          <PriceTag
            price={PRODUCT_DISCOUNT.price}
            compareAtPrice={PRODUCT_DISCOUNT.compareAtPrice}
            size="sm"
            installments="short"
            showDiscountBadge
          />
        </Demo>
        <Demo label="PriceTag · md" hint="carrinho, resumo">
          <PriceTag
            price={PRODUCT_NORMAL.price}
            referencePrice={PRODUCT_NORMAL.referencePrice}
            size="md"
            installments="short"
          />
        </Demo>
        <Demo label="PriceTag · lg" hint="página de produto, total do checkout">
          <PriceTag
            price={PRODUCT_DISCOUNT.price}
            compareAtPrice={PRODUCT_DISCOUNT.compareAtPrice}
            referencePrice={PRODUCT_DISCOUNT.referencePrice}
            size="lg"
            installments="long"
            showDiscountBadge
          />
        </Demo>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="Badges" hint="24 px · caption · tons suaves; chapado só em cta e primary">
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Frete grátis</Badge>
            <Badge variant="soft">Novo</Badge>
            <Badge variant="cta">-25%</Badge>
            <Badge variant="primary">Selecionado</Badge>
            <Badge variant="warning">Últimas unidades</Badge>
            <Badge variant="danger">Cancelado</Badge>
            <Badge variant="neutral">Usado</Badge>
            <Badge variant="outline">Loja oficial</Badge>
            <Badge variant="inverse">Esgotado</Badge>
          </div>
        </Demo>
        <Demo label="Avaliação" hint="estrelas em gold (só ícone); a nota carrega o contraste">
          <div className="flex flex-col gap-3">
            <RatingStars value={4.5} count={128} size="md" />
            <RatingStars value={3.5} count={12} size="sm" />
            <RatingStars value={4.7} size="xs" variant="compact" count={128} />
          </div>
        </Demo>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confiança                                                            */
/* ------------------------------------------------------------------ */

export function TrustSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Demo
        label="SellerBadge"
        hint="inline · pill · card com reputação em barra e tempo de envio"
        bare
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs">
            <SellerBadge seller={SELLER} variant="inline" />
            <SellerBadge seller={SELLER} variant="pill" />
          </div>
          <SellerBadge
            seller={SELLER}
            variant="card"
            metrics={{ onTimeShippingPercent: 98, avgResponseTimeHours: 2 }}
          />
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
            {([1, 2, 3, 4, 5] as const).map((level) => (
              <div key={level} className="flex items-center gap-3">
                <span className="w-16 text-caption text-foreground-muted">nível {level}</span>
                <ReputationMeter level={level} className="flex-1" />
              </div>
            ))}
          </div>
        </div>
      </Demo>
      <Demo
        label="Garantia, impostos e prazo"
        hint="sempre com uma linha explicando o que significa"
        bare
      >
        <div className="flex flex-col gap-3">
          <GuaranteeBadge variant="card" />
          <ImportTaxLine
            amount={{ amount: 58455, currency: "BRL" }}
            ratePercent={60}
            variant="card"
          />
          <DeliveryWindow range={{ min: 7, max: 12 }} variant="card" />
          <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
            <p className="mb-3 text-caption font-medium text-foreground-secondary uppercase">
              Inline (resumo do checkout)
            </p>
            <div className="flex flex-col gap-4">
              <ImportTaxLine amount={{ amount: 58455, currency: "BRL" }} ratePercent={60} />
              <DeliveryWindow range={{ min: 7, max: 12 }} />
            </div>
          </div>
        </div>
      </Demo>
      <Demo
        label="OrderTimeline"
        hint="passado preenchido · atual com anel pulsando · futuro em neutral-300"
        className="md:col-span-2"
      >
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <OrderTimeline status="EmTransitoInternacional" events={TIMELINE_EVENTS} />
          <div className="flex flex-wrap gap-2 md:max-w-xs md:flex-col md:items-start">
            {(
              [
                "AguardandoPagamento",
                "Pago",
                "Enviado",
                "EmTransitoInternacional",
                "Entregue",
                "Cancelado",
                "EmDisputa",
              ] as const
            ).map((s) => (
              <OrderStatusBadge key={s} status={s} />
            ))}
          </div>
        </div>
      </Demo>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navegação                                                            */
/* ------------------------------------------------------------------ */

export function NavigationSection() {
  return (
    <Demo
      label="Bottom nav"
      hint="64 px + safe-area · surface translúcida com borda · pill atrás do ícone ativo · badge do carrinho em cta"
      bare
    >
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border bg-background shadow-xs">
        <div className="h-16 bg-surface-muted/60" aria-hidden />
        <BottomNav embedded activeKey="home" />
      </div>
    </Demo>
  );
}

/* ------------------------------------------------------------------ */
/* Sheets e diálogos                                                    */
/* ------------------------------------------------------------------ */

export function OverlaysSection() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [freeShipping, setFreeShipping] = useState(true);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Demo label="Bottom sheet" hint="raio 24 no topo · handle · arraste para fechar">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          <Filter data-icon="inline-start" /> Abrir filtros
        </Button>
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <BottomSheetContent>
            <BottomSheetHeader>
              <BottomSheetTitle>Filtros</BottomSheetTitle>
              <BottomSheetDescription>
                Refine os resultados sem sair da busca.
              </BottomSheetDescription>
            </BottomSheetHeader>
            <BottomSheetBody className="flex flex-col gap-6 py-4">
              <div className="flex flex-col gap-3">
                <span className="text-body-sm font-medium text-foreground">Frete</span>
                <label className="flex items-center justify-between gap-3 text-body-sm text-foreground">
                  Só com frete grátis
                  <Switch checked={freeShipping} onCheckedChange={setFreeShipping} />
                </label>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-body-sm font-medium text-foreground">Faixa de preço</span>
                <div className="grid grid-cols-2 gap-3">
                  <Input inputMode="numeric" placeholder="R$ mín." aria-label="Preço mínimo" />
                  <Input inputMode="numeric" placeholder="R$ máx." aria-label="Preço máximo" />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-body-sm font-medium text-foreground">Categoria</span>
                <div className="flex flex-wrap gap-2">
                  {["Eletrônicos", "Perfumes", "Informática", "Celulares"].map((c, i) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={i === 0}
                      className="inline-flex h-8 items-center rounded-full border border-border-strong px-3 text-caption font-medium text-foreground focus-ring transition-colors aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </BottomSheetBody>
            <BottomSheetFooter>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setSheetOpen(false)}>
                  Limpar
                </Button>
                <Button className="flex-1" onClick={() => setSheetOpen(false)}>
                  Ver 128 produtos
                </Button>
              </div>
            </BottomSheetFooter>
          </BottomSheetContent>
        </BottomSheet>
      </Demo>
      <Demo label="Diálogo" hint="raio 24 · sombra lg · confirmações destrutivas com ícone + texto">
        <Button variant="destructive" onClick={() => setDialogOpen(true)}>
          <Trash2 data-icon="inline-start" /> Cancelar pedido
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar este pedido?</DialogTitle>
              <DialogDescription>
                O vendedor ainda não postou. O valor volta para o mesmo meio de pagamento em até 5
                dias úteis.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Manter pedido
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setDialogOpen(false);
                  toast.success("Pedido cancelado", {
                    description: "O estorno já foi solicitado.",
                  });
                }}
              >
                <Trash2 data-icon="inline-start" /> Cancelar pedido
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Demo>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                             */
/* ------------------------------------------------------------------ */

export function FeedbackSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Demo label="Toasts" hint="discretos, no topo; ação opcional">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast.success("Adicionado ao carrinho", {
                action: { label: "Ver carrinho", onClick: () => undefined },
              })
            }
          >
            Sucesso
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast.error("Não foi possível pagar", {
                description: "Cartão recusado. Tente outro meio.",
              })
            }
          >
            Erro
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toast("Link copiado")}>
            Neutro
          </Button>
        </div>
      </Demo>
      <Demo label="Skeleton" hint="shimmer sutil, no formato exato do conteúdo">
        <div className="flex gap-3">
          <Skeleton className="size-16 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        </div>
      </Demo>
      <Demo label="Estado vazio" hint="ilustração linear + frase curta + uma ação" bare>
        <div className="rounded-lg border border-border bg-surface shadow-xs">
          <EmptyState
            illustration="bag"
            title="Seu carrinho está vazio"
            description="Explore as ofertas do dia e aproveite o frete grátis."
            action={<Button>Ver ofertas</Button>}
          />
        </div>
      </Demo>
      <Demo label="Estado de erro" hint="ícone + texto, sempre" bare>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface shadow-xs">
            <ErrorState onRetry={() => toast("Tentando de novo…")} />
          </div>
          <ErrorState compact onRetry={() => toast("Tentando de novo…")} />
        </div>
      </Demo>
    </div>
  );
}
