import type { usePushNotifications } from './notifications.hooks';

type PushDeviceStatusProps = Pick<ReturnType<typeof usePushNotifications>, 'status' | 'error'>;

export function PushDeviceStatus({ status, error }: PushDeviceStatusProps) {
  return (
    <p className="text-xs text-muted-foreground">
      {status === 'subscribed' && 'Activas: recibirás alertas en este dispositivo'}
      {status === 'denied' && 'Bloqueadas: actívalas en los permisos del navegador'}
      {status === 'unsupported' && 'No soportado en este navegador'}
      {status === 'error' && error}
      {(status === 'idle' || status === 'loading') && 'Inactivas'}
    </p>
  );
}
