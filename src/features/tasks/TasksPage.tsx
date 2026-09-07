'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useQuickAddStore } from './quick-add.store';
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
  const { setOpen } = useQuickAddStore();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5 py-5 md:px-8 md:py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[1.41rem] font-bold tracking-[-0.02em]">Tareas</h1>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-5" />
          Nueva tarea
        </Button>
      </div>

      <KinoSuggestedSection />

      <AllTasksList systems={systems} />
    </div>
  );
}
