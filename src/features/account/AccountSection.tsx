'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { UserProfile } from '@clerk/nextjs';
import { Segmented } from '@/components/ui/segmented';
import { clerkAppearance } from '@/features/auth/clerk-appearance';
import { ALTO_CUENTA } from '@/features/settings/settings-copy';

export type PaginaCuenta = 'perfil' | 'seguridad';

const PAGINAS: ReadonlyArray<{ value: PaginaCuenta; label: string }> = [
  { value: 'perfil', label: 'Perfil' },
  { value: 'seguridad', label: 'Seguridad' },
];

/** La página de Clerk que dice el hash: `routing="hash"` pone Seguridad en `#/security`. */
export function paginaDelHash(hash: string): PaginaCuenta {
  return hash.startsWith('#/security') ? 'seguridad' : 'perfil';
}

function suscribir(avisar: () => void) {
  window.addEventListener('hashchange', avisar);
  return () => window.removeEventListener('hashchange', avisar);
}

function usePagina(): PaginaCuenta {
  return useSyncExternalStore(
    suscribir,
    () => paginaDelHash(window.location.hash),
    () => 'perfil',
  );
}

/**
 * Nombre, correo, contraseña, proveedores y sesiones activas viven en el panel
 * de Clerk, dentro de la hoja de Cuenta. Se carga sólo al abrir la hoja (la
 * importa `next/dynamic` desde el índice): era lo que más pesaba de Ajustes.
 *
 * Perfil y Seguridad son un segmento a la vista, en el teléfono y en
 * escritorio: el menú de Clerk escondía Seguridad (contraseña y sesiones)
 * tras un icono sin etiqueta que se leía como un título. El segmento mueve
 * el hash, que es la ruta de Clerk con `routing="hash"`, y sigue al hash si
 * Clerk navega solo. Al cerrar la hoja el hash se limpia, para que Ajustes
 * no se quede apuntando a una página de Clerk.
 *
 * Viste los tokens de Diario a través de `clerkAppearance`; aquí se le quita
 * la caja, la cabecera y el menú (la hoja ya tiene título y el segmento es la
 * navegación), sus acciones secundarias pasan a tinta y sus destinos miden
 * 2.85rem. El `!` es lo que gana a los estilos propios de Clerk.
 */
export function AccountSection() {
  const pagina = usePagina();

  useEffect(
    () => () => {
      if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    },
    [],
  );

  return (
    <div data-slot="account-section" className={ALTO_CUENTA}>
      <Segmented
        aria-label="Página de la cuenta"
        value={pagina}
        onValueChange={(next) => {
          window.location.hash = next === 'seguridad' ? '/security' : '/';
        }}
        options={PAGINAS}
        className="w-full [&>*]:flex-1"
      />
      <UserProfile
        routing="hash"
        appearance={{
          ...clerkAppearance,
          elements: {
            ...clerkAppearance.elements,
            rootBox: '!w-full',
            // Sin caja y sin el alto mínimo de Clerk: la hoja mide lo que hay.
            cardBox: '!w-full !max-w-none !h-auto !min-h-0 !shadow-none !border-0 !rounded-none !bg-transparent',
            scrollBox: '!h-auto !min-h-0 !rounded-none !shadow-none !border-0 !bg-transparent',
            // El segmento de arriba es la navegación; el menú de Clerk y su
            // fila con "Cuenta" repetían el título de la hoja.
            navbar: '!hidden',
            navbarMobileMenuRow: '!hidden',
            header: '!hidden',
            pageScrollBox: '!h-auto !min-h-0 !px-0 !py-0',
            // El contenido arranca en el borde del texto de la hoja, como el
            // segmento, y no sangrado 21 px más con 34 px de aire encima.
            profilePageContent: '!px-0 !pt-2 !pb-2',
            // Acciones secundarias en tinta: el ámbar es sólo la primaria.
            profileSectionPrimaryButton: '!min-h-[2.85rem] !text-foreground',
            menuButton: '!min-h-[2.85rem] !min-w-[2.85rem] !text-foreground',
          },
        }}
      />
    </div>
  );
}
