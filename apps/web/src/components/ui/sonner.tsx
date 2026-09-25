"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Toasts no estilo "ink": pílula escura, texto branco em negrito, ícone colorido. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-brand-blue-300" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-brand-red-400" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--ink)",
          "--normal-text": "var(--ink-foreground)",
          "--normal-border": "transparent",
          "--success-bg": "var(--ink)",
          "--success-text": "var(--ink-foreground)",
          "--success-border": "transparent",
          "--error-bg": "var(--ink)",
          "--error-text": "var(--ink-foreground)",
          "--error-border": "transparent",
          "--info-bg": "var(--ink)",
          "--info-text": "var(--ink-foreground)",
          "--info-border": "transparent",
          "--warning-bg": "var(--ink)",
          "--warning-text": "var(--ink-foreground)",
          "--warning-border": "transparent",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans !font-bold !shadow-ink",
          description: "!text-ink-muted !font-medium",
          actionButton: "!bg-card !text-foreground !font-bold !rounded-md",
          cancelButton: "!bg-ink-muted/30 !text-ink-foreground !rounded-md",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
