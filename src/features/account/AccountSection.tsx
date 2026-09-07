'use client';

import { UserProfile } from '@clerk/nextjs';
import { clerkAppearance } from '@/features/auth/clerk-appearance';

/**
 * Nombre, correo, contraseña, proveedores y sesiones activas viven en el panel
 * de Clerk, embebido aquí. `routing="hash"` mantiene sus pestañas en la URL de
 * Ajustes sin pedir una ruta propia.
 */
export function AccountSection() {
  return (
    <div className="space-y-4">
      {/* El panel de Clerk trae su propia cabecera "Cuenta": una sola, la suya. */}
      <UserProfile
        routing="hash"
        appearance={{
          ...clerkAppearance,
          elements: {
            ...clerkAppearance.elements,
            rootBox: 'w-full',
            cardBox: 'w-full shadow-none border border-border rounded-2xl',
            navbar: 'hidden',
            navbarMobileMenuRow: 'hidden',
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
          },
        }}
      />
    </div>
  );
}
