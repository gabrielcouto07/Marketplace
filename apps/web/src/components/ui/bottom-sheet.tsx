"use client";

import * as React from "react";
import type { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet (DESIGN.md › Bottom sheets): topo com raio 24, handle visível e fechamento por
 * arraste (Base UI Drawer). Use para filtros, variações, frete por CEP e seleção de pagamento.
 *
 * <BottomSheet open={open} onOpenChange={setOpen}>
 *   <BottomSheetContent>
 *     <BottomSheetHeader><BottomSheetTitle>Filtros</BottomSheetTitle></BottomSheetHeader>
 *     <BottomSheetBody>…</BottomSheetBody>
 *     <BottomSheetFooter><Button fullWidth>Aplicar</Button></BottomSheetFooter>
 *   </BottomSheetContent>
 * </BottomSheet>
 */
function BottomSheet(props: DrawerPrimitive.Root.Props) {
  return <Drawer showSwipeHandle swipeDirection="down" {...props} />;
}

const BottomSheetTrigger = DrawerTrigger;
const BottomSheetClose = DrawerClose;

function BottomSheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DrawerPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  const t = useTranslations("common");
  return (
    <DrawerContent className={cn("pb-safe", className)} {...props}>
      {children}
      {showCloseButton ? (
        <DrawerClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3"
              aria-label={t("close")}
            />
          }
        >
          <XIcon strokeWidth={1.75} />
        </DrawerClose>
      ) : null}
    </DrawerContent>
  );
}

function BottomSheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <DrawerHeader className={cn("gap-1 px-4 pt-2 pr-14 pb-2", className)} {...props} />;
}

function BottomSheetTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return <DrawerTitle className={cn("text-title-2 text-foreground", className)} {...props} />;
}

function BottomSheetDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerDescription
      className={cn("text-body-sm text-foreground-secondary", className)}
      {...props}
    />
  );
}

/** Área rolável do conteúdo. */
function BottomSheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bottom-sheet-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2", className)}
      {...props}
    />
  );
}

function BottomSheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <DrawerFooter
      className={cn("border-t border-border bg-surface px-4 pt-3 pb-3", className)}
      {...props}
    />
  );
}

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetBody,
  BottomSheetFooter,
};
