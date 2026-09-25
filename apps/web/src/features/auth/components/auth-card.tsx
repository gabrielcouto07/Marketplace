"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { useGoogleLogin } from "@/features/auth/api";

import { useAuthRedirect } from "./use-auth-redirect";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Casca das telas de autenticação: marca, título, card branco com o formulário e rodapé. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-5 sm:py-10">
      <div className="mb-5 flex animate-rise flex-col items-center gap-3 text-center">
        <BrandMark tone="light" />
        <div>
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">{title}</h1>
          {subtitle ? <p className="mt-1 text-[13.5px] text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      <div
        className="animate-rise rounded-3xl bg-card p-4 shadow-card sm:p-6"
        style={{ animationDelay: "40ms" }}
      >
        {children}
      </div>
      {footer ? (
        <div
          className="mt-5 animate-rise text-center text-sm text-muted-foreground"
          style={{ animationDelay: "80ms" }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Caixa azul-suave com a dica de acesso à demo. */
export function DemoHint({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="rounded-lg bg-accent px-3.5 py-2.5 text-center text-xs font-semibold text-accent-foreground"
    >
      {children}
    </p>
  );
}

/** Divisor "ou". */
export function OrDivider() {
  const t = useTranslations("auth");
  return (
    <div
      className="my-4 flex items-center gap-3 text-[11px] font-bold tracking-[0.08em] text-placeholder uppercase"
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
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={login.isPending}
      onClick={() =>
        login.mutate(undefined, {
          onSuccess: (session) => {
            toast.success(t("welcome", { name: session.user.fullName.split(" ")[0] }));
            redirect();
          },
          onError: () => toast.error(t("loginError")),
        })
      }
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" data-icon="inline-start">
        <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text
          x="12"
          y="16.5"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="currentColor"
          fontFamily="inherit"
        >
          G
        </text>
      </svg>
      {t("continueWithGoogle")}
    </Button>
  );
}
