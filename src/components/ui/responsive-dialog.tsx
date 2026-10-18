"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

/**
 * Mismo API que Dialog, pero en mobile (<768px) se renderiza como la hoja
 * inferior de Diario (Drawer/vaul): se siente nativa y convive mejor con el
 * teclado. La hoja trae asa y botón Cerrar; `showCloseButton` vale en los
 * dos modos.
 *
 * `mobileClassName` en Content permite sobreescribir clases solo del drawer
 * (el `className` de desktop suele traer max-w/centrados que no aplican).
 */

interface ResponsiveDialogRootProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function ResponsiveDialog(props: ResponsiveDialogRootProps) {
  const isMobile = useIsMobile()
  // repositionInputs de vaul descarta el drawer cuando el teclado se cierra
  // (p. ej. al avanzar de step en un form multi-paso); el navegador ya
  // gestiona el teclado bien con max-h en dvh.
  if (isMobile) return <Drawer repositionInputs={false} {...props} />
  return <Dialog {...props} />
}

function ResponsiveDialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const isMobile = useIsMobile()
  if (isMobile) return <DrawerTrigger {...props} />
  return <DialogTrigger {...props} />
}

function ResponsiveDialogContent({
  className,
  mobileClassName,
  showCloseButton,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  mobileClassName?: string
}) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <DrawerContent className={mobileClassName} showCloseButton={showCloseButton}>
        <div className="space-y-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    )
  }
  return (
    <DialogContent className={className} showCloseButton={showCloseButton} {...props}>
      {children}
    </DialogContent>
  )
}

function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const isMobile = useIsMobile()
  // El contenedor scrolleable ya lleva el padding y el área segura.
  if (isMobile) return <DrawerFooter className={className ?? "p-0 pb-0"} {...props} />
  return <DialogFooter className={className} {...props} />
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  const isMobile = useIsMobile()
  // El padding del header del drawer ya lo aporta el contenedor scrolleable
  if (isMobile) return <DrawerHeader className={className ?? "p-0"} {...props} />
  return <DialogHeader className={className} {...props} />
}

function ResponsiveDialogTitle({
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useIsMobile()
  if (isMobile) return <DrawerTitle {...props} />
  return <DialogTitle {...props} />
}

function ResponsiveDialogDescription({
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useIsMobile()
  if (isMobile) return <DrawerDescription {...props} />
  return <DialogDescription {...props} />
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
}
