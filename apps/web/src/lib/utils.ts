import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge precisa conhecer a escala tipográfica do DESIGN.md (text-display, text-title-1…)
 * para não confundi-la com cores de texto (text-primary-foreground) ao resolver conflitos.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "title-1", "title-2", "title-3", "body", "body-sm", "caption"] },
      ],
      shadow: [{ shadow: ["xs", "sm", "md", "lg"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
