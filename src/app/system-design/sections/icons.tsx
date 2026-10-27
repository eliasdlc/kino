"use client";

import { Section, SubSection } from "../helpers";
import { ICON_MAP, DEFAULT_ICON } from "@/features/systems/system-icons";
import {
  Plus,
  Trash2,
  X,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Zap,
  Clock,
  Timer,
  Sparkles,
  Pencil,
  MoreHorizontal,
  Moon,
  Sun,
  Download,
  ArrowRight,
  Target,
  Coffee,
  Check,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  PanelRight,
  PanelLeft,
  Minus,
  FolderOpen,
  FolderPlus,
  Flag,
  FileText,
  FilePlus,
  Files,
  CheckCircle2,
  Bell,
  StickyNote,
  SlidersHorizontal,
  Settings,
  Play,
  LogOut,
  LayoutGrid,
  Calendar,
  CalendarClock,
  CalendarRange,
  Battery,
  User,
  TrendingUp,
  Search,
  Inbox,
  type LucideIcon,
} from "lucide-react";

const APP_ICONS: Array<[string, LucideIcon]> = [
  ["Plus", Plus],
  ["Trash2", Trash2],
  ["X", X],
  ["Check", Check],
  ["CheckCircle2", CheckCircle2],
  ["ChevronRight", ChevronRight],
  ["ChevronDown", ChevronDown],
  ["ChevronLeft", ChevronLeft],
  ["ArrowRight", ArrowRight],
  ["MoreHorizontal", MoreHorizontal],
  ["Pencil", Pencil],
  ["Search", Search],
  ["Zap", Zap],
  ["Battery", Battery],
  ["Clock", Clock],
  ["Timer", Timer],
  ["Calendar", Calendar],
  ["CalendarClock", CalendarClock],
  ["CalendarRange", CalendarRange],
  ["Sparkles", Sparkles],
  ["Target", Target],
  ["Flag", Flag],
  ["Coffee", Coffee],
  ["Moon", Moon],
  ["Sun", Sun],
  ["Bell", Bell],
  ["AlertCircle", AlertCircle],
  ["AlertTriangle", AlertTriangle],
  ["RotateCcw", RotateCcw],
  ["Play", Play],
  ["Minus", Minus],
  ["Download", Download],
  ["FolderOpen", FolderOpen],
  ["FolderPlus", FolderPlus],
  ["FileText", FileText],
  ["FilePlus", FilePlus],
  ["Files", Files],
  ["StickyNote", StickyNote],
  ["SlidersHorizontal", SlidersHorizontal],
  ["Settings", Settings],
  ["PanelLeft", PanelLeft],
  ["PanelRight", PanelRight],
  ["LayoutGrid", LayoutGrid],
  ["Inbox", Inbox],
  ["User", User],
  ["LogOut", LogOut],
  ["TrendingUp", TrendingUp],
];

function IconCell({ name, Icon }: { name: string; Icon: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-3">
      <Icon className="size-5" />
      <span className="w-full truncate text-center font-mono text-[10px] text-muted-foreground">
        {name}
      </span>
    </div>
  );
}

export function IconsSection() {
  return (
    <Section
      id="iconos"
      number="04"
      title="Iconografía"
      description="Familia única: lucide-react, trazo 1.8 en reposo; el activo es el mismo glifo relleno al 20 % con trazo 2, nunca un segundo glifo. Tamaños: 1.25rem en botones, 1rem en menús y metadatos, 0.875rem en lo denso. En el margen de Diario el glifo va en mute. Sin emojis ni spinners: un estado de carga es texto o un esqueleto."
    >
      <SubSection title="Tamaños">
        <div className="flex items-end gap-6 rounded-lg border border-dashed border-border p-4">
          {[
            ["size-3.5", "0.875rem, denso"],
            ["size-4", "1rem, menús y margen"],
            ["size-5", "1.25rem, botones"],
            ["size-6", "1.5rem, destacado"],
          ].map(([cls, label]) => (
            <div key={cls} className="flex flex-col items-center gap-2">
              <Zap className={cls} strokeWidth={1.8} />
              <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection
        title="Iconos de sistema (ICON_MAP)"
        description="Set cerrado que el usuario puede elegir para un sistema (features/systems/system-icons.ts). Box es el fallback."
      >
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
          {Object.entries(ICON_MAP).map(([name, Icon]) => (
            <IconCell key={name} name={name} Icon={Icon} />
          ))}
          <IconCell name="(default)" Icon={DEFAULT_ICON} />
        </div>
      </SubSection>

      <SubSection
        title="Iconos frecuentes en la app"
        description="Los más usados en la UI actual, para mantener consistencia al elegir un icono nuevo: antes de importar otro, revisa si uno de estos ya comunica lo mismo."
      >
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
          {APP_ICONS.map(([name, Icon]) => (
            <IconCell key={name} name={name} Icon={Icon} />
          ))}
        </div>
      </SubSection>
    </Section>
  );
}
