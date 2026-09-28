"use client";

import { useEffect, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/states";
import { LoginRequired } from "@/features/account/components/profile-view";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { usePathname, useRouter } from "@/i18n/navigation";

import { isSellerRequiredError, useSellerProfile } from "../api";

export const SELLER_REGISTER_PATH = "/vendedor/cadastro";

/**
 * Guarda do painel: exige sessão; sem loja cadastrada (403 SELLER_REQUIRED) manda para o cadastro;
 * na página de cadastro, quem já tem loja volta para o painel.
 */
export function SellerGate({ children }: { children: ReactNode }) {
  const hydrated = useStoreHydrated(useAuthStore);
  const user = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const isRegisterPage = pathname === SELLER_REGISTER_PATH;
  const profile = useSellerProfile(hydrated && Boolean(user));
  const needsRegistration = isSellerRequiredError(profile.error);

  useEffect(() => {
    if (!hydrated || !user) return;
    if (needsRegistration && !isRegisterPage) router.replace(SELLER_REGISTER_PATH);
    if (profile.data && isRegisterPage) router.replace("/vendedor");
  }, [hydrated, user, needsRegistration, isRegisterPage, profile.data, router]);

  if (!hydrated) return null;
  if (!user) return <LoginRequired next={pathname} />;
  if (isRegisterPage) return profile.data ? null : <>{children}</>;
  if (profile.isPending || needsRegistration) return <PanelSkeleton />;
  if (profile.isError)
    return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  return <>{children}</>;
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
