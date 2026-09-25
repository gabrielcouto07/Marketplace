import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Link / useRouter / usePathname / redirect cientes do locale ativo.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
