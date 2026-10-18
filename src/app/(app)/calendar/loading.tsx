import { EsqueletoCalendarioEscritorio, EsqueletoCalendarioTelefono } from "@/features/calendar/CalendarioEsqueleto";

/** La forma del calendario: la página del día en el teléfono, la rejilla en escritorio. */
export default function CalendarLoading() {
  return (
    <div aria-busy className="h-full">
      <div className="md:hidden">
        <EsqueletoCalendarioTelefono />
      </div>
      <div className="hidden h-full md:flex">
        <EsqueletoCalendarioEscritorio />
      </div>
    </div>
  );
}
