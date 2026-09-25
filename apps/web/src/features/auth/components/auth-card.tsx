"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useGoogleLogin } from "@/features/auth/api";

import { useAuthRedirect } from "./use-auth-redirect";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Página de autenticação: marca com tile, título e subtítulo no topo; o formulário vive
 * num único card (surface, borda, sombra xs); o rodapé traz o link alternativo.
 */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandLogo tile size={48} />
        <div className="flex flex-col gap-1">
          <h1 className="text-title-1 text-foreground">{title}</h1>
          {subtitle ? <p className="text-body text-foreground-secondary">{subtitle}</p> : null}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">{children}</div>
      {footer ? (
        <p className="flex flex-wrap items-center justify-center gap-1 text-center text-body-sm text-foreground-secondary">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

/** Erro de API que não pertence a um campo: sempre ícone + texto, em danger-soft. */
export function ApiErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return <ErrorState compact title={message} />;
}

/** Caixa azul-suave com a dica de acesso à demo. */
export function DemoHint({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="rounded-md bg-primary-soft p-3 text-center text-caption text-primary">
      {children}
    </p>
  );
}

/** Divisor "ou". */
export function OrDivider() {
  const t = useTranslations("auth");
  return (
    <div
      className="my-4 flex items-center gap-3 text-caption text-foreground-muted uppercase"
      role="separator"
    >
      <span className="h-px flex-1 bg-border" />
      {t("or")}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Botão "Continuar com Google" (mock). Ícone genérico: círculo com a letra G. */
export function GoogleButton() {
  const t = useTranslations("auth");
  const login = useGoogleLogin();
  const redirect = useAuthRedirect();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <ApiErrorNotice message={error} />
      <Button
        type="button"
        variant="secondary"
        fullWidth
        loading={login.isPending}
        onClick={() => {
          setError(null);
          login.mutate(undefined, {
            onSuccess: (session) => {
              toast.success(t("welcome", { name: session.user.fullName.split(" ")[0] }));
              redirect();
            },
            onError: () => setError(t("loginError")),
          });
        }}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" data-icon="inline-start">
          <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <text
            x="12"
            y="16.5"
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            fill="currentColor"
            fontFamily="inherit"
          >
            G
          </text>
        </svg>
        {t("continueWithGoogle")}
      </Button>
    </div>
  );
}
