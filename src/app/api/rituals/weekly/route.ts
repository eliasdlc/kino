/**
 * GET: estado del ritual, vencidas y dónde caben en la semana.
 * POST: aplica el reparto confirmado.
 */
export {
  getWeeklyRitualRoute as GET,
  applyWeeklyRitualRoute as POST,
} from '@/features/energy/energy.routes';
