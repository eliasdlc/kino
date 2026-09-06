import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { Bricolage_Grotesque, Inter, JetBrains_Mono, Literata } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { SITE_URL } from "@/shared/lib/site-url";
import { rootThemeScript } from "@/shared/lib/theme-script";
import { clerkAppearance } from "@/features/auth/clerk-appearance";
import { ConvexClientProvider } from "@/shared/convex/client";

// Las caras del producto, cargadas una sola vez para la app y el marketing:
// Inter para el texto, Bricolage para la cifra y los títulos, JetBrains para
// datos y código. Literata es la serif de lectura del arquetipo Writing.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
const literata = Literata({ subsets: ["latin"], variable: "--font-literata" });


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
  // Los dos valores de `--background`. La barra del navegador en móvil sigue la
  // preferencia del sistema, no la clase `dark`: quien fuerza un tema distinto
  // al del SO verá la barra del otro, que es el límite del atributo.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161616" },
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
      className={cn("h-full", "antialiased", "font-sans", inter.variable, bricolage.variable, jetbrainsMono.variable, literata.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: rootThemeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Dentro de body a propósito: Clerk inyecta su script ahí. Las rutas
            de entrada y a dónde vuelve cada una se declaran aquí y no en
            variables de entorno, para que un preview no dependa de Vercel. */}
        <ClerkProvider
          localization={esES}
          appearance={clerkAppearance}
          signInUrl="/login"
          signUpUrl="/register"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/onboarding"
          afterSignOutUrl="/login"
        >
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
