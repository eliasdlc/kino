'use client';

import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useUrlView } from '@/shared/hooks/use-url-view';
import { cn } from '@/lib/utils';
import { useUserSettings } from '@/features/settings/settings.hooks';
import { useQuickAddStore } from './quick-add.store';
import { KinoSuggestedSection } from './KinoSuggestedSection';
import { AllTasksList } from './AllTasksList';
import { useAllTasks, useSuggestedTasks, useTodayPlanTasks } from './tasks.hooks';
import { ListaDeTareasSkeleton, TAREAS_COLUMNA, TAREAS_PAGINA, TareasCabecera, VOZ_LISTA } from './TasksSkeleton';

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
 *
 * La cabecera y el segmento van siempre en la columna de Lista: pasar a
 * Calendario ensancha sólo el calendario, y el título no cambia de sitio.
 */
export function TasksPageClient({ systems }: TasksPageProps) {
  const { setOpen } = useQuickAddStore();
  const [vista, setVista] = useUrlView(VISTAS, 'lista');

  return (
    <div className={TAREAS_PAGINA}>
      <div className={cn(TAREAS_COLUMNA, 'space-y-6')}>
        <TareasCabecera
          accion={
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-5" />
              Nueva tarea
            </Button>
          }
          voz={
            vista === 'lista' ? (
              VOZ_LISTA
            ) : (
              <>
                {/* En el teléfono el calendario abre un día; en escritorio, la semana. */}
                <span className="md:hidden">El día, con lo que tiene hora y lo que falta programar.</span>
                <span className="max-md:hidden">La semana, con lo que tiene hora y lo que falta programar.</span>
              </>
            )
          }
        />

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

        {vista === 'lista' && <ListaDeTareas systems={systems} />}
      </div>

      {vista === 'calendario' && (
        <section aria-label="Calendario de tareas">
          <CalendarioDeTareas />
        </section>
      )}
    </div>
  );
}

/**
 * Lo de Lista espera entero y llega de una vez. Lo sugerido, el presupuesto,
 * las vencidas y todas las tareas salen de cuatro suscripciones que llegan en
 * momentos distintos; si cada sección se pintara al llegar la suya, las de
 * abajo bajarían cada vez (las vencidas, al aparecer, empujaban Todas las
 * tareas fuera de la pantalla: 0,33 de CLS a 393 px). Mientras falte alguna,
 * va el esqueleto de la lista, el mismo de `loading.tsx`; cuando están todas,
 * la lista entra entera y nada que ya estuviera en pantalla se mueve. Las
 * secciones vuelven a pedir lo mismo, y Convex comparte la suscripción.
 */
function ListaDeTareas({ systems }: TasksPageProps) {
  const sugeridas = useSuggestedTasks();
  const todas = useAllTasks();
  const ajustes = useUserSettings();
  const plan = useTodayPlanTasks();

  if (sugeridas.isLoading || todas.isLoading || ajustes.isLoading || plan.isLoading) {
    return <ListaDeTareasSkeleton />;
  }

  return (
    <>
      <KinoSuggestedSection />
      <AllTasksList systems={systems} />
    </>
  );
}
