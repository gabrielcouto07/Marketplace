"use client";

import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toasts discretos no topo: surface com borda fina e sombra md, ícone semântico, texto body-sm. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      offset={{ top: "calc(var(--safe-top) + 12px)" }}
      icons={{
        success: <CircleCheck className="size-5 text-success" strokeWidth={1.75} />,
        info: <Info className="size-5 text-primary" strokeWidth={1.75} />,
        warning: <TriangleAlert className="size-5 text-warning" strokeWidth={1.75} />,
        error: <OctagonX className="size-5 text-danger" strokeWidth={1.75} />,
        loading: <Loader2 className="size-5 animate-spin text-foreground-secondary" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--surface)",
          "--success-text": "var(--text)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--surface)",
          "--error-text": "var(--text)",
          "--error-border": "var(--border)",
          "--info-bg": "var(--surface)",
          "--info-text": "var(--text)",
          "--info-border": "var(--border)",
          "--warning-bg": "var(--surface)",
          "--warning-text": "var(--text)",
          "--warning-border": "var(--border)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "font-sans !text-body-sm !font-medium !shadow-md",
          description: "!text-foreground-secondary !font-normal",
          actionButton: "!bg-primary !text-primary-foreground !font-semibold !rounded-sm",
          cancelButton: "!bg-surface-muted !text-foreground !rounded-sm",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
