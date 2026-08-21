/**
 * GET: propuesta de bloques del día (lectura, no escribe nada).
 * POST: coloca o mueve el bloque de una tarea en un día y hora locales.
 * DELETE: saca la tarea del calendario sin tocar su fecha límite.
 */
export {
  getBlockProposalRoute as GET,
  scheduleBlockRoute as POST,
  clearBlockRoute as DELETE,
} from '@/features/energy/energy.routes';
