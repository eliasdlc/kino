import {
  User,
  MapPin,
  Package,
  Lightbulb,
  CalendarClock,
  Users,
  Shapes,
  type LucideIcon,
} from "lucide-react";
import type { EntityType } from "./entities.attributes";

export const ENTITY_TYPE_ICON: Record<EntityType, LucideIcon> = {
  character: User,
  location: MapPin,
  object: Package,
  concept: Lightbulb,
  event: CalendarClock,
  faction: Users,
  other: Shapes,
};

/** Etiqueta singular por tipo (para "Crear personaje", fichas, filtros). */
export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  character: "Personaje",
  location: "Lugar",
  object: "Objeto",
  concept: "Concepto",
  event: "Evento",
  faction: "Facción",
  other: "Otro",
};

export const ENTITY_TYPE_LABEL_PLURAL: Record<EntityType, string> = {
  character: "Personajes",
  location: "Lugares",
  object: "Objetos",
  concept: "Conceptos",
  event: "Eventos",
  faction: "Facciones",
  other: "Otros",
};
