import { GlobalCalendarView } from "@/features/calendar/GlobalCalendarView";

export const metadata = { title: "Calendario - Kino" };

export default function CalendarPage() {
  return (
    <div className="h-full flex flex-col">
      <GlobalCalendarView />
    </div>
  );
}
