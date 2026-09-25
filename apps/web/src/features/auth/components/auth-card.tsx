"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useGoogleLogin } from "@/features/auth/api";
import { toast } from "sonner";

import { useAuthRedirect } from "./use-auth-redirect";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Casca das telas de autenticação: logo, título, formulário e rodapé. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <Image src="/logo.svg" alt="" width={56} height={56} className="mb-3 size-14" priority />
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">{children}</div>
      {footer ? <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

/** Divisor "ou". */
export function OrDivider() {
  const t = useTranslations("auth");
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground uppercase" role="separator">
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
        <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" fontFamily="Inter, Arial, sans-serif">
          G
        </text>
      </svg>
      {t("continueWithGoogle")}
    </Button>
  );
}
