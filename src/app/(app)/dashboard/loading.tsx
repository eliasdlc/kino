import { HoySkeleton } from "@/features/dashboard/HoySkeleton";

/**
 * Hoy mientras llega: la misma página, en tonos de superficie. La forma vive
 * con la página (`HoySkeleton`, en features/dashboard) y comparte con ella el
 * canto y las columnas, así que la cota, la curva y el plan caen en su sitio.
 */
export default function DashboardLoading() {
  return <HoySkeleton />;
}
