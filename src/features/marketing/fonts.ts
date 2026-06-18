import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";

/**
 * Fuentes del sitio público (landing, docs) y de las pantallas de auth.
 * Centralizadas aquí para cargarlas una sola vez y compartir las variables CSS
 * entre los layouts (marketing)/(auth). Las utilidades font-display/body/jetbrains
 * mapean a estas variables en globals.css.
 */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});
const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});
const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
  display: "swap",
});

export const marketingFontVars = `${bricolage.variable} ${instrument.variable} ${jbMono.variable}`;
