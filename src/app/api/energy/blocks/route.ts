import { NextRequest } from 'next/server';
import {
  getBlockProposalRoute,
  scheduleBlockRoute,
  clearBlockRoute,
} from '@/features/energy/energy.routes';

/** Propuesta de bloques del día (lectura, no escribe nada). */
export function GET(request: NextRequest) {
  return getBlockProposalRoute(request);
}

/** Coloca o mueve el bloque de una tarea en un día y hora locales. */
export function POST(request: NextRequest) {
  return scheduleBlockRoute(request);
}

/** Saca la tarea del calendario sin tocar su fecha límite. */
export function DELETE(request: NextRequest) {
  return clearBlockRoute(request);
}
