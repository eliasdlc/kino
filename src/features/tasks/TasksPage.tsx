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
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">El cerebro de Kino — qué deberías hacer hoy.</p>
        </div>
        <Button variant="outline" className="w-fit" onClick={() => setOpen(true)}>
          <Plus size={16} className="mr-1" />
          Nueva tarea
        </Button>
      </div>

      <KinoSuggestedSection />

      <AllTasksList systems={systems} />
    </div>
  );
}
