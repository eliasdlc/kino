'use client';

import { Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnergyAdvisorBannerAction {
  label: string;
  onClick: () => void;
}

interface EnergyAdvisorBannerProps {
  message: string;
  icon?: LucideIcon;
  action?: EnergyAdvisorBannerAction;
  className?: string;
}

export function EnergyAdvisorBanner({
  message,
  icon: Icon = Zap,
  action,
  className,
}: EnergyAdvisorBannerProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-amber-500/8 border border-amber-500/20 text-sm',
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      <p className="flex-1 min-w-0 text-muted-foreground truncate">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
