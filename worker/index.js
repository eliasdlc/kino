/**
 * Custom worker de next-pwa (KIN-57).
 *
 * next-pwa compila este archivo y lo importa dentro del `sw.js` que genera, así
 * que es el único sitio donde vive código de service worker escrito a mano.
 * Contiene lo que antes estaba en `public/kino-sw.js` y no cubre Workbox: la
 * recepción de notificaciones push, sus botones («Hecha», «En 1 h»), el foco
 * de ventana al pulsarlas, y el destino de compartir.
 *
 * Lo que NO va aquí: precache del shell, fallback de `/offline` y estrategias de
 * red. De eso se encarga la configuración de next-pwa en `next.config.ts`.
 *
 * Dos avisos que nadie debería deshacer:
 *  - el handler del destino de compartir tiene que estar registrado aquí, junto
 *    a los de push, porque este es el único worker que existe;
 *  - el plugin de PWA es de **webpack**, así que sin `pnpm build` (que ya lleva
 *    `--webpack`) el service worker no se emite y el build sale verde igual.
 */

import { atenderCompartido, guardarEnCola, leerDueno } from '@/features/captures/shareTarget';

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  // Los botones sólo cuando el aviso es de una tarea y trae su enlace firmado:
  // sin él no habría con qué decirle al servidor de qué tarea se trata.
  const actions = data.accion
    ? [
        { action: 'hecha', title: 'Hecha' },
        { action: 'posponer', title: 'En 1 h' },
      ]
    : [];
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Kino', {
      body: data.body ?? '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: { url: data.url ?? '/dashboard', accion: data.accion ?? null },
      // El mismo `tag` sustituye a la notificación anterior de esa tarea en
      // vez de apilar una más, y `renotify` hace que la nueva vuelva a sonar.
      tag: data.tag,
      renotify: Boolean(data.tag),
      // Un aviso de tarea se queda en pantalla hasta que alguien lo mire: el
      // problema que resuelve es justo que se olvide.
      requireInteraction: Boolean(data.accion),
      actions,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url = '/dashboard', accion = null } = event.notification.data ?? {};

  // «Hecha» y «En 1 h» se resuelven sin abrir la app: el enlace firmado ya
  // dice de qué tarea es, y el servidor no necesita más. Va como texto plano
  // para que el navegador no pida permiso de CORS antes.
  if ((event.action === 'hecha' || event.action === 'posponer') && accion) {
    event.waitUntil(
      fetch(accion.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ token: accion.token, accion: event.action }),
      }).catch(() => self.clients.openWindow(url))
    );
    return;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(url) && 'focus' in client) return client.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});

/**
 * El POST de la hoja de compartir. Se responde aquí y antes de la red: la
 * cookie de sesión es `Lax` y no viaja en un POST cross-site, así que dejarlo
 * llegar al servidor termina en un redirect a login que se come el cuerpo
 * multipart. Lo compartido se guarda y se contesta con un redirect a GET.
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/compartir') return;

  event.respondWith(
    atenderCompartido(event.request, {
      guardar: guardarEnCola,
      duenoActual: leerDueno,
      nuevoId: () => crypto.randomUUID(),
      ahora: () => Date.now(),
    }).catch(
      () =>
        // Nunca la pantalla de error de la app: aquí hay que decir dónde quedó
        // lo compartido, y sólo esta ruta puede decirlo.
        new Response(null, { status: 303, headers: { Location: '/compartir?fallo=1' } })
    )
  );
});
