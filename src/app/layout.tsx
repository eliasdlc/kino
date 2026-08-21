import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Literata } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { SITE_URL } from "@/shared/lib/site-url";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

// Serif de lectura del arquetipo Writing: la "sensación de escritor" del editor.
const literata = Literata({ subsets: ["latin"], variable: "--font-literata" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


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
  themeColor: "#000000",
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
      className={cn("h-full", "antialiased", geistMono.variable, "font-sans", inter.variable, literata.variable)}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
