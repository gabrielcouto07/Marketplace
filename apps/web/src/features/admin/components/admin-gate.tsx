"use client";

import { useEffect, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { usePathname, useRouter } from "@/i18n/navigation";

export const ADMIN_LOGIN_PATH = "/admin/entrar";

/** Guarda do admin: sem sessão ou sem o papel Admin → login alternativo em /admin/entrar. */
export function AdminGate({ children }: { children: ReactNode }) {
  const hydrated = useStoreHydrated(useAuthStore);
  const user = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === ADMIN_LOGIN_PATH;
  const isAdmin = Boolean(user?.roles.includes("Admin"));

  useEffect(() => {
    if (!hydrated) return;
    if (!isAdmin && !isLoginPage) router.replace(ADMIN_LOGIN_PATH);
    if (isAdmin && isLoginPage) router.replace("/admin");
  }, [hydrated, isAdmin, isLoginPage, router]);

  if (!hydrated) return null;
  if (isLoginPage) return isAdmin ? null : <>{children}</>;
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }
  return <>{children}</>;
}
