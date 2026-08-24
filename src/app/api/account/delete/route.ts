/**
 * POST y no DELETE /api/account: el cuerpo lleva el correo de confirmación y
 * un DELETE con body es terreno pantanoso en proxies y clientes.
 */
export { deleteAccountRoute as POST } from '@/features/account/account.routes';
