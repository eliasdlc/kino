"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useState } from "react";

let client: ConvexReactClient | undefined;

/**
 * El cliente de Convex del navegador, uno por pestaña. Lo usa el proveedor de
 * abajo y el código que corre fuera de React (las extensiones del editor).
 */
export function getConvexClient(): ConvexReactClient {
  client ??= new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  return client;
}

/**
 * El cliente de Convex, autenticado con la sesión de Clerk. Va en el layout
 * raíz, debajo de `ClerkProvider`, así que toda la app lo tiene; sin sesión el
 * cliente existe igual y las queries esperan a que la haya.
 */
export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const [convex] = useState(getConvexClient);
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
