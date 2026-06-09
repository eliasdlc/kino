'use client';

import { CreateTaskDialog } from './CreateTaskDialog';
import { KinoSuggestedSection } from './KinoSuggestedSection';
import { AllTasksList } from './AllTasksList';

interface SystemInfo {
  id: string;
  name: string;
  color: string | null;
}

interface TasksPageProps {
  systems: SystemInfo[];
}

export function TasksPageClient({ systems }: TasksPageProps) {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">El cerebro de Kino — qué deberías hacer hoy.</p>
        </div>
        <CreateTaskDialog systemId="all-tasks" />
      </div>

      <KinoSuggestedSection />

      <AllTasksList systems={systems} />
    </div>
  );
}
