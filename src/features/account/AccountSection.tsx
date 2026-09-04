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
      <div>
        <h2 className="text-lg font-semibold">Cuenta</h2>
        <p className="text-sm text-muted-foreground">Tu identidad, tu contraseña y desde dónde estás dentro.</p>
      </div>
      <UserProfile
        routing="hash"
        appearance={{
          ...clerkAppearance,
          elements: { ...clerkAppearance.elements, rootBox: 'w-full', cardBox: 'w-full shadow-none border border-border' },
        }}
      />
    </div>
  );
}
