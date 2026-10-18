import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Bricolage_Grotesque, Figtree, JetBrains_Mono, Literata } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import type { CSSProperties } from "react";
import { SITE_URL } from "@/shared/lib/site-url";
import { rootThemeScript } from "@/shared/lib/theme-script";
import { clerkAppearance, clerkLocalization } from "@/features/auth/clerk-appearance";
import { ConvexClientProvider } from "@/shared/convex/client";

// Las caras del producto, cargadas una sola vez para la app y el marketing:
// Figtree para la interfaz, Bricolage para la cota y los títulos, Literata
// para la prosa y para la voz (la frase de la cota, la intención de un
// sistema), por eso trae cursiva. JetBrains es para datos y código y no se
// precarga: ninguna pantalla la necesita antes de pintar.
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap", preload: false });
const literata = Literata({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-literata", display: "swap" });

// Los toasts leen los roles: sonner pinta con estas variables y sigue al
// tema por la clase `dark`, sin richColors. Suben por encima del chrome
// inferior en todo ancho (offset y mobileOffset con el mismo cálculo: sonner
// sólo aplica el segundo bajo 600 px, y el chrome existe hasta 767). Las
// acciones (Deshacer, Cancelar) son pastillas de 2.85rem; van con importante
// porque sonner las fija a 24 px con un selector de atributo.
const toasterStyle = {
  "--normal-bg": "var(--sf)",
  "--normal-text": "var(--ink)",
  "--normal-border": "var(--ln2)",
  "--border-radius": "1.125rem",
  "--font-family": "var(--font-sans)",
} as CSSProperties;


export const metadata: Metadata = {
  // Base de los canonical/OpenGraph de las páginas públicas (landing, docs y
  // las landings por arquetipo), que declaran sus URLs en relativo.
  metadataBase: new URL(SITE_URL),
  title: "Kino",
  description: "Gestión de energía",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kino",
  },
};

export const viewport: Viewport = {
  // La página llega a los bordes del dispositivo y el shell suma las áreas
  // seguras con env() (cabecera arriba, pie abajo); sin `cover` esos env()
  // valen cero. Con el teclado abierto el viewport encoge, así que las hojas
  // de abajo (paleta, nueva tarea) suben con él en vez de quedar tapadas.
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  // Los dos valores de `--bg` (globals.css). La barra del navegador en móvil
  // sigue la preferencia del sistema, no la clase `dark`: quien fuerza un
  // tema distinto al del SO verá la barra del otro, que es el límite del
  // atributo.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#171512" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn("h-full", "antialiased", "font-sans", figtree.variable, bricolage.variable, jetbrainsMono.variable, literata.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: rootThemeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Dentro de body a propósito: Clerk inyecta su script ahí. Las rutas
            de entrada y a dónde vuelve cada una se declaran aquí y no en
            variables de entorno, para que un preview no dependa de Vercel. */}
        <ClerkProvider
          localization={clerkLocalization}
          appearance={clerkAppearance}
          signInUrl="/login"
          signUpUrl="/register"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/onboarding"
          afterSignOutUrl="/login"
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
        <Toaster
          position="bottom-right"
          style={toasterStyle}
          offset={{ bottom: "calc(var(--kino-bottom-chrome) + 1rem)" }}
          mobileOffset={{ bottom: "calc(var(--kino-bottom-chrome) + 1rem)" }}
          toastOptions={{
            classNames: {
              toast: "font-sans",
              actionButton: "h-[2.85rem]! rounded-full! px-4! text-sm! font-semibold! bg-primary! text-primary-foreground!",
              cancelButton: "h-[2.85rem]! rounded-full! px-4! text-sm! font-semibold! bg-secondary! text-secondary-foreground!",
            },
          }}
        />
      </body>
    </html>
  );
}
