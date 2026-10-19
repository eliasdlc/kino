'use client';

import { useId, type ReactNode } from 'react';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarginRow } from '@/components/ui/margin-row';
import { Switch } from '@/components/ui/switch';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { cn } from '@/lib/utils';

/**
 * Las piezas del índice de Ajustes. Cada fila mide siempre lo mismo, cargue o
 * no: el título y la meta van en una línea cada uno y lo que todavía no llegó
 * ocupa su renglón con un tono de superficie. Es lo que deja el CLS de la
 * pantalla en cero, porque nada empuja a nada cuando llegan los datos.
 */

/** El tono de superficie que ocupa un renglón mientras llega su texto. Es un span para vivir dentro de un botón. */
export function Pendiente({ className }: { className?: string }) {
  return <span aria-hidden data-slot="pendiente" className={cn('inline-block h-3.5 w-36 rounded-md bg-muted align-middle', className)} />;
}

/**
 * Las clases del título de un grupo, compartidas con el esqueleto. Arranca
 * donde arranca el h1 de la página: en la columna de texto en el teléfono
 * (el h1 de `PageHeader` deja el margen a su izquierda) y en el borde desde md
 * (donde `PageHeader` pliega su margen). El hairline va de borde a borde: el
 * texto no entra en el margen, la línea sí lo cruza.
 */
export const TITULO_GRUPO =
  'border-b border-ln2 pb-2 pl-(--margen) font-display text-[1.18rem] font-bold tracking-[-0.02em] text-foreground md:pl-0';

/** Un grupo del índice: el título de sección en display y un hairline debajo. Sin caja. */
export function SettingsGroup({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-slot="settings-group" className={className}>
      <h2 id={id} className={TITULO_GRUPO}>
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

/** El título y la meta de una fila, cada uno en su renglón. La meta que falta es un `Pendiente`. */
function Texto({
  title,
  meta,
  tone,
  titleId,
  metaId,
  wrap,
}: {
  title: ReactNode;
  meta: ReactNode | undefined;
  tone?: 'danger' | 'warn';
  titleId?: string;
  metaId?: string;
  /** En una hoja la meta explica y puede ocupar varias líneas; en el índice, una. */
  wrap?: boolean;
}) {
  return (
    <>
      <span id={titleId} className={cn('block truncate text-base leading-6 font-semibold text-foreground', tone === 'danger' && 'text-destructive')}>
        {title}
      </span>
      <span
        id={metaId}
        data-slot="settings-meta"
        className={cn(
          'block text-sm leading-5 text-muted-foreground',
          wrap ? 'text-pretty' : 'h-5 truncate',
          tone === 'warn' && 'text-warn',
        )}
      >
        {meta === undefined ? <Pendiente /> : meta}
      </span>
    </>
  );
}

/**
 * Una fila del índice que abre su hoja: glifo en el margen, título, meta y, a
 * la derecha, el valor y el chevron. La fila entera es el botón.
 */
export function IndexRow({
  icon,
  title,
  meta,
  value,
  onOpen,
  onPrefetch,
  tone,
  wrap,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  /** undefined mientras carga: ocupa su renglón igual. */
  meta: ReactNode | undefined;
  value?: ReactNode;
  /** Sin `onOpen` la fila es informativa y no lleva chevron. */
  onOpen?: () => void;
  /** Al apuntar o enfocar la fila: para traer el código de su hoja antes del toque. */
  onPrefetch?: () => void;
  tone?: 'danger' | 'warn';
  /** La meta en varias líneas, para una fila de hoja que explica. */
  wrap?: boolean;
  className?: string;
}) {
  return (
    <MarginRow
      margin={<span className={cn('mt-[0.5rem] flex', tone === 'danger' && 'text-destructive')}>{icon}</span>}
      onClick={onOpen}
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
      aria-haspopup={onOpen ? 'dialog' : undefined}
      className={className}
      trailing={
        onOpen || value !== undefined ? (
          <span className="inline-flex items-center gap-1">
            {value}
            {/* Sin chevron, su hueco: el valor queda en la misma columna que
                los valores de las filas que abren hoja. */}
            {onOpen ? <ChevronRight aria-hidden className="size-4 shrink-0" /> : <span aria-hidden className="size-4 shrink-0" />}
          </span>
        ) : undefined
      }
    >
      <Texto title={title} meta={meta} tone={tone} wrap={wrap} />
    </MarginRow>
  );
}

/**
 * Una fila con su control debajo del texto: el reloj, el segmento, las
 * pastillas. Para lo que no cabe a la derecha en 393 px.
 */
export function ControlRow({
  icon,
  title,
  meta,
  children,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <MarginRow margin={<span className="mt-[0.5rem] flex">{icon}</span>} className={cn('pb-2', className)}>
      <span className="block text-base leading-6 font-semibold text-foreground">{title}</span>
      {meta !== undefined && <span className="block text-sm leading-5 text-muted-foreground">{meta}</span>}
      <span className="mt-2 flex flex-wrap items-center gap-2">{children}</span>
    </MarginRow>
  );
}

/**
 * Una fila con su control a la derecha (el stepper). La fila no es tocable:
 * lo tocable es el control.
 */
export function TrailingRow({
  icon,
  title,
  meta,
  titleId,
  wrap,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  meta: ReactNode | undefined;
  titleId?: string;
  wrap?: boolean;
  children: ReactNode;
}) {
  return (
    <MarginRow margin={<span className="mt-[0.5rem] flex">{icon}</span>} trailing={children}>
      <Texto title={title} meta={meta} titleId={titleId} wrap={wrap} />
    </MarginRow>
  );
}

/**
 * Un interruptor con la fila entera de zona de toque: la fila es la etiqueta
 * del interruptor, así que tocar el título, la meta o el margen lo cambia, y
 * no hace falta apuntar al dibujo de 2.15rem. La fila mide lo mismo que una
 * fila del índice, más de 48 px.
 */
export function SwitchRow({
  icon,
  title,
  meta,
  checked,
  disabled,
  onCheckedChange,
  tone,
  wrap,
}: {
  icon: ReactNode;
  title: ReactNode;
  meta: ReactNode | undefined;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  tone?: 'warn';
  wrap?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      data-slot="switch-row"
      className={cn(
        'grid min-h-[3.4rem] w-full grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border last:border-b-0',
        disabled
          ? 'cursor-not-allowed'
          : 'cursor-pointer transition-[background-color] duration-(--dur-toque) ease-(--ease-pluma) hover:bg-sf2/60',
      )}
    >
      <span className="flex justify-center self-start pt-[0.15rem] text-muted-foreground">
        <span className="mt-[0.5rem] flex">{icon}</span>
      </span>
      <span className="block min-w-0 py-2">
        <Texto title={title} meta={meta} titleId={`${id}-titulo`} metaId={`${id}-meta`} tone={tone} wrap={wrap} />
      </span>
      <span className="flex items-center pr-1 pl-3">
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          aria-labelledby={`${id}-titulo`}
          aria-describedby={`${id}-meta`}
          onCheckedChange={onCheckedChange}
        />
      </span>
    </label>
  );
}

/**
 * El paso siguiente sobre la rejilla del paso: de 47 con paso 5, + da 50 y
 * - da 45, y de 1 + da 5. Un valor fuera de la rejilla (el mínimo, o uno que
 * venía de antes) vuelve a ella en el primer toque en vez de arrastrar el
 * desfase para siempre. Los topes los pone quien lo llama.
 */
export function siguientePaso(value: number, step: number, direccion: 1 | -1): number {
  return direccion === 1 ? Math.floor(value / step) * step + step : Math.ceil(value / step) * step - step;
}

/**
 * El stepper de Instrumento, injertado en Diario: un toque por paso, la cifra
 * en Bricolage entre los dos botones de 2.85rem. Sustituye al campo con botón
 * Guardar y al deslizador: con el pulgar, un toque exacto gana a arrastrar.
 * Mientras no hay valor, los botones esperan desactivados y la cifra ocupa su
 * sitio, así que la fila no cambia de ancho al llegar el dato.
 */
export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  labelledBy,
  unit,
  stepLabel,
}: {
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** El id del título de la fila, que nombra al grupo. */
  labelledBy?: string;
  /** Lo que sigue a la cifra, en mute: "h". */
  unit?: string;
  /** Cómo se dice un paso en los botones: "5 puntos", "1 hora". */
  stepLabel: string;
}) {
  const listo = value !== undefined;
  const mover = (direccion: 1 | -1) => {
    if (value === undefined) return;
    onChange(Math.min(max, Math.max(min, siguientePaso(value, step, direccion))));
  };
  return (
    <span role="group" aria-labelledby={labelledBy} data-slot="stepper" className="inline-flex items-center rounded-full border border-ln2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Restar ${stepLabel}`}
        disabled={!listo || value <= min}
        onClick={() => mover(-1)}
      >
        <Minus aria-hidden />
      </Button>
      <output aria-live="polite" className="min-w-[2.7rem] text-center font-display text-lg font-bold text-foreground tabular-nums">
        {listo ? (
          <>
            {value}
            {unit && <span className="ml-0.5 font-sans text-sm font-normal text-muted-foreground">{unit}</span>}
          </>
        ) : (
          <Pendiente className="w-6" />
        )}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Sumar ${stepLabel}`}
        disabled={!listo || value >= max}
        onClick={() => mover(1)}
      >
        <Plus aria-hidden />
      </Button>
    </span>
  );
}

/**
 * La hoja de una sección: la hoja inferior en el teléfono, el diálogo en
 * escritorio. Lleva el título de la sección y su explicación; el contenido
 * va en filas de margen, como el índice.
 */
export function SettingsSheet({
  open,
  onOpenChange,
  title,
  description,
  wide,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        className={cn('max-h-[88dvh] overflow-y-auto sm:max-w-lg', wide && 'sm:max-w-4xl')}
        mobileClassName="[&_[data-slot=drawer-close]]:z-20"
      >
        {/* En el teléfono el título se queda arriba al desplazar una hoja larga,
            con el fondo de la hoja a todo el ancho: nada del texto asoma junto
            al botón Cerrar, que queda por encima de la franja. La explicación
            sí se desplaza. */}
        <ResponsiveDialogHeader className="max-md:sticky max-md:-top-4 max-md:z-10 max-md:-mt-4 max-md:-mx-4 max-md:bg-popover max-md:pt-4 max-md:pr-14 max-md:pb-2 max-md:pl-4">
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {description ? (
          <ResponsiveDialogDescription className="text-sm leading-snug text-body">{description}</ResponsiveDialogDescription>
        ) : (
          <ResponsiveDialogDescription className="sr-only">{title}</ResponsiveDialogDescription>
        )}
        <div data-slot="settings-sheet-body">{children}</div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** Lo que ocupa una hoja mientras llega su código: filas del alto real, o el alto que la hoja reserva. */
export function SheetLoading({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div aria-busy className={className}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid min-h-[3.4rem] grid-cols-[var(--margen)_1fr] items-center border-b border-border py-2 last:border-b-0">
          <span />
          <span className="space-y-1.5">
            <Pendiente className="block h-4 w-2/5" />
            <Pendiente className="block h-3 w-3/5" />
          </span>
        </div>
      ))}
    </div>
  );
}
