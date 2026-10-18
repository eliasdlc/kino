'use client';

import { UserProfile } from '@clerk/nextjs';
import { clerkAppearance } from '@/features/auth/clerk-appearance';

/**
 * Nombre, correo, contraseña, proveedores y sesiones activas viven en el panel
 * de Clerk, dentro de la hoja de Cuenta. Se carga sólo al abrir la hoja (la
 * importa `next/dynamic` desde el índice): era lo que más pesaba de Ajustes y
 * lo que, al llegar tarde arriba de todo, empujaba la pantalla entera.
 *
 * Viste los tokens de Diario a través de `clerkAppearance`; aquí sólo se le
 * quita la caja, porque la hoja ya es la superficie. `routing="hash"` mantiene
 * sus pestañas (Perfil, Seguridad) en la URL de Ajustes sin pedir una ruta.
 */
export function AccountSection() {
  return (
    <UserProfile
      routing="hash"
      appearance={{
        ...clerkAppearance,
        elements: {
          ...clerkAppearance.elements,
          // Clerk pinta su caja con estilos propios que ganan a una clase
          // normal: el `!` es lo que la quita de verdad.
          rootBox: '!w-full',
          cardBox: '!w-full !max-w-none !shadow-none !border-0 !rounded-none !bg-transparent',
          scrollBox: '!rounded-none !shadow-none !border-0 !bg-transparent',
          navbar: '!border-0 !bg-transparent',
          navbarMobileMenuRow: '!bg-transparent',
          pageScrollBox: '!px-0 !py-2',
          // El título de la página repetiría el de la hoja.
          headerTitle: 'hidden',
          headerSubtitle: 'hidden',
        },
      }}
    />
  );
}
