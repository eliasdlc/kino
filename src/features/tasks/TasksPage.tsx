'use client';

import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageWrapper';
import { Segmented } from '@/components/ui/segmented';
import { useUrlView } from '@/shared/hooks/use-url-view';
import { cn } from '@/lib/utils';
import { useQuickAddStore } from './quick-add.store';
import { KinoSuggestedSection } from './KinoSuggestedSection';
import { AllTasksList } from './AllTasksList';
import { TAREAS_PAGINA } from './TasksSkeleton';

interface SystemInfo {
  id: string;
  name: string;
  color: string | null;
}

interface TasksPageProps {
  systems: SystemInfo[];
}

const VISTAS = ['lista', 'calendario'] as const;
type Vista = (typeof VISTAS)[number];

/**
 * El calendario es el mismo de /calendar, sin reconstruirlo: carga aparte y
 * sólo cuando se elige, porque trae la rejilla de la semana y su arrastre.
 */
const CalendarioDeTareas = dynamic(
  () => import('@/features/calendar/GlobalCalendarView').then((m) => m.GlobalCalendarView),
  {
    ssr: false,
    loading: () => <p className="py-6 pl-(--margen) text-sm text-muted-foreground">Abriendo el calendario</p>,
  },
);

/**
 * Tareas es una página de Diario: el título, la voz que dice de dónde sale lo
 * sugerido, y un segmento Lista | Calendario, que es la segunda puerta del
 * teléfono al calendario (la primera es la fecha de Hoy). En Lista van tres
 * secciones con título y hairline, sin cards: lo sugerido para hoy con el
 * presupuesto de energía, las vencidas y todas las demás. Todas las filas son
 * la misma fila de tarea.
 */
export function TasksPageClient({ systems }: TasksPageProps) {
  const { setOpen } = useQuickAddStore();
  const [vista, setVista] = useUrlView(VISTAS, 'lista');

  return (
    <div className={cn(TAREAS_PAGINA, vista === 'calendario' && 'max-w-none')}>
      <PageHeader
        title="Tareas"
        actions={
          // En el teléfono crear es el orbe del pie; el botón sólo duplicaría.
          <Button onClick={() => setOpen(true)} className="max-md:hidden">
            <Plus className="size-5" />
            Nueva tarea
          </Button>
        }
      />

      {/* La voz va fuera de PageHeader: dentro, su bloque no crece en una fila
          flex con acciones y la frase se parte palabra por palabra en escritorio. */}
      <p className="-mt-3 pl-(--margen) font-voice text-base leading-snug text-body italic md:pl-0">
        Lo sugerido sale de tu energía de hoy y de lo que vence.
      </p>

      <Segmented<Vista>
        aria-label="Vista de tareas"
        value={vista}
        onValueChange={setVista}
        options={[
          { value: 'lista', label: 'Lista' },
          { value: 'calendario', label: 'Calendario' },
        ]}
        className="max-md:ml-(--margen)"
      />

      {vista === 'lista' ? (
        <>
          <KinoSuggestedSection />
          <AllTasksList systems={systems} />
        </>
      ) : (
        <section aria-label="Calendario de tareas">
          <CalendarioDeTareas />
        </section>
      )}
    </div>
  );
}
