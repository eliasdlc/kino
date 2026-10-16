# DESIGN.md: la identidad visual de Kino

Este documento describe lo que Kino **es hoy**, no una dirección nueva. Cada
valor sale de un fichero del repo y lleva su fichero y su línea al lado. La
fuente de verdad sigue siendo el código (`src/app/globals.css` sobre todo) y el
catálogo vivo `/system-design`; si este texto y el código discrepan, gana el
código y este texto se corrige en el mismo PR.

Donde la gramática compartida pedía una decisión que el código no zanjaba, la
línea dice la lectura y que se aceptó el 16 de octubre de 2026, cuando Elias
delegó esas decisiones.

Las decisiones citadas como `DECISIONS:<línea>` están en
`~/Documents/Proyectos/Kino/dev/Kino-DECISIONS.md`, fuera del repo.

## Identidad

Picked: "quiero que ámbar sea el color primario" (Elias, 2026-09-06, la 2B del rework de UI/UX, DECISIONS:44). Del mismo día son su 3A, Bricolage como display (DECISIONS:45), y la 1A, Hoy como la cota (DECISIONS:43); Literata como serif de lectura fue su verde en el PR #108 (DECISIONS:46). Aceptado el 16 de octubre: que este documento entero, y no sólo esas tres elecciones, quede como la identidad elegida.

Display face: Bricolage Grotesque 700, sólo en la cifra y los títulos de pantalla. La carga `next/font/google` en `src/app/layout.tsx:3` y `:16` (variable `--font-bricolage`), que la autoaloja en el build; el token es `--font-display` (`src/app/globals.css:21`).

Body face: Inter para todo lo demás, botones, chips, pestañas, etiquetas y el subhead en 700 (`src/app/layout.tsx:15`, `src/app/globals.css:19` y `:23`); JetBrains Mono para datos y código (`layout.tsx:17`, `globals.css:20`); Literata, serif de lectura del arquetipo Writing y del modo lectura (`layout.tsx:18`, `globals.css:24`). Las cuatro por `next/font/google`, autoalojadas.

Brand hue: #e8b04b, el ámbar de hue 38 (`src/app/globals.css:79-80` y `:181`); su par claro #8a5a00 (`:90`) tiene el mismo hue.

Neutrals: teñidos con el hue del ámbar, saturación 4 en claro y 6 en oscuro (`globals.css:79-80`). Oscuro: --bg #131211, --sf #1e1c1a, --sf2 #2b2926, --ink #f6f5f3, --mute #9f9a92 (`:175-180`). Claro: --sf #ffffff, --sf2 #ecebea, --ink #1f1c18, --mute #6d685f (`:85-89`); el --bg claro está en la tabla de color, con su nota.

Accent: #8a5a00 en claro y #e8b04b en oscuro (`globals.css:90` y `:181`), con `--on` encima (#ffffff y #1a1204). Va en dos sitios: la acción (botón primario, orbe de crear, enlace) y la selección (pestaña activa, destino activo de la barra, foco). Las excepciones decididas están en la sección Acento.

Radius: escala en rem sobre la raíz de 17 (`globals.css:66-75`): detalle 0.5rem (8,5 px), chip 0.75rem (12,75), control 1rem (17), bloque 1.125rem (19,1), superficie 1.375rem (23,4), y toda acción o estado a 999 (`rounded-full`). La card es superficie (`src/components/ui/card.tsx:15`), el menú bloque con filas a chip (`dropdown-menu.tsx:46` y `:76`), el campo control (`input.tsx:11`), el botón pill (`button.tsx:8`).

Signature: la cota. La energía del día como cifra en Bricolage a 4.18rem en el ámbar, compartiendo renglón con la palabra y la frase que la explican, y debajo de dónde sale (`src/features/dashboard/EnergyTodayCard.tsx:89-94` y `:175`, `src/app/(app)/dashboard/page.tsx:20-25`). Es la única cifra de ese tamaño en el producto y es lo que hace de Kino un instrumento y no otra lista (DECISIONS:43, :50).

Borrowed from: las primitivas son shadcn/ui en estilo `radix-vega` sobre Radix (`components.json:3`), el cajón móvil es vaul (`package.json:85`, `ResponsiveDialog`), los iconos lucide (`components.json:13`), y la geometría (pill, radios por clase de tamaño, barra flotante de vidrio con el orbe aparte, elevación por tono en oscuro) viene de la gramática compartida, que se extrajo de Liora y se inclina hacia iOS. Aceptado el 16 de octubre: nombrar el producto real del que sale la cota; mi lectura es la cifra de Readiness de Oura y el anillo de Apple Health, una cifra grande que se explica con una palabra.

Rejected default: lo que el scaffold traía y no se quedó: `baseColor: "neutral"` de shadcn (`components.json:9`), su `--radius: 0.625rem` uniforme (sigue declarado en `globals.css:120` sin que la escala lo lea), Geist de create-next-app (quedan sus SVG en `public/next.svg`, `public/vercel.svg`), y Framer Motion (`AGENTS.md:306`). Rechazados por Elias: petróleo 196 y salvia 150 como color (DECISIONS:44), Literata como display y una sola familia (DECISIONS:45), el ritual y la lista calma como estructura de Hoy (DECISIONS:43), las manchas radiales y el gradiente del marketing (DECISIONS:51).

Imagery: ninguna propia. La app enseña el contenido de la persona (imágenes de entidades en `src/features/entities/EntityImages.tsx`, referencias en `src/features/writing/ReferenceTable.tsx`, lo compartido en `src/app/(share)/compartir/CompartirScreen.tsx:64`) y la landing enseña el producto vivo (`HeroDemo` en `src/features/marketing/landing/LandingHero.tsx:44`); `public/` no tiene fotografía ni ilustración. Aceptado el 16 de octubre: que la razón sea que el producto es el instrumento y la imagen sería decorado.

## Color

Cada color sale de un rol y cada rol tiene un valor por modo (`globals.css:78-82`). Los tokens de shadcn no declaran color: valen `var(--rol)` (`:122-153`). El tema lo elige el dispositivo, con la cuenta de respaldo y el sistema por defecto (`src/shared/lib/theme-script.ts:17-27`).

| Rol | Claro | Oscuro | Qué es |
|---|---|---|---|
| `--bg` | #f5f5f4 (`:84`) | #131211 (`:175`) | fondo de pantalla |
| `--sf` | #ffffff (`:85`) | #1e1c1a (`:176`) | superficie |
| `--sf2` | #ecebea (`:86`) | #2b2926 (`:177`) | superficie sobre superficie |
| `--ink` | #1f1c18 (`:87`) | #f6f5f3 (`:178`) | títulos y valores |
| `--body` | #46423c (`:88`) | #d8d5d0 (`:179`) | texto corrido |
| `--mute` | #6d685f (`:89`) | #9f9a92 (`:180`) | metadatos e inactivos |
| `--ac` | #8a5a00 (`:90`) | #e8b04b (`:181`) | acción y selección |
| `--on` | #ffffff (`:91`) | #1a1204 (`:182`) | sobre el acento |
| `--warn` | #a83f22 (`:92`) | #e8836a (`:183`) | vencida, coral hue 12 |
| `--ok` | #1e7a45 (`:93`) | #5fcb8a (`:184`) | hecha |
| `--danger` | #b3123a (`:94`) | #ff5c7a (`:185`) | lo irreversible, carmesí hue 350 |
| `--ln` / `--ln2` | ink al 8% y al 16% (`:95-96`) | igual | hairline y hairline fuerte |

Contrastes medidos sobre `--bg` claro: ink 15,4, body 8,7, mute 4,7, ac 5,4 (`globals.css:82`).

**Nota sobre el `--bg` claro.** #f5f5f4 sale bien de la derivación (hue 38, saturación 4, luminosidad 96 redondea justo ahí), pero coincide con un valor de la escala stone de Tailwind. El hook `design-identity` rechaza ese hex en la línea `Neutrals:` (por eso no está arriba) y en toda edición que lo escriba, y el cierre de turno relee `globals.css` entero, así que cualquier turno que toque ese fichero recibe un aviso por él. Aceptado el 16 de octubre: moverlo a #f6f5f4 (saturación 8, luminosidad 96, el mismo hue y casi el mismo blanco roto) en un PR de UI con sus capturas, en vez de nombrar stone en la línea `Neutrals:`, que dejaría pasar toda la escala stone en cualquier componente.

Los estados de tarea acompañan a la palabra y nunca la sustituyen: vencida es `--warn` con "vencida" delante, hecha es `--ok` con el check, crítica y alta son peso y orden en tinta, no color (`globals.css:155-165`, DECISIONS:50).

Tres paletas físicas viven fuera de los roles, a propósito (`src/app/system-design/sections/colors.tsx:93`): los once colores de sistema (`colors.tsx:130`, safelist en `globals.css:7-10`), el papel de las notas adhesivas (`colors.tsx:168`) y los tres niveles de energía, alto verde, medio amarillo, bajo rojo (`colors.tsx:186`).

## Acento

La regla es acción y selección. Las excepciones que ya están decididas, cada una con su razón:

- La cifra de la cota va siempre en el acento y el tono lo lleva la palabra (DECISIONS:50; `EnergyTodayCard.tsx:175`).
- El sobregiro usa el acento con la cifra delante, porque el coral es de vencida y el rojo de lo irreversible (DECISIONS:60, 4A; `src/features/energy/OverBudgetExit.tsx:45`).
- Una captura sin confirmar lleva una barra de acento a la izquierda de su fila (DECISIONS:67).
- La frase con nota sin color propio cae al ámbar a baja opacidad (`globals.css:523-535`); con color, lleva el de su papel (`:544-571`, DECISIONS:75).

## Tipografía

Dos caras y una mono, más la serif de lectura (`globals.css:15-26`). La display nunca va en una primitiva: `src/components/ui/faces.test.ts:1-7` falla si alguna la usa.

| Estilo | Valor | Dónde |
|---|---|---|
| Cifra (la cota) | Bricolage 700, 4.18rem, interlínea 0.86, -0.03em, cifras tabulares | `EnergyTodayCard.tsx:175` |
| Título de pantalla | Bricolage 700, 1.41rem, -0.02em | `src/components/PageWrapper.tsx:18` |
| Encabezado | Bricolage 700, `text-xl`, -0.02em | `OverBudgetExit.tsx:45`, `src/features/energy/CeilingMutedNotice.tsx:38` |
| Subhead | Inter 700 (`font-heading`), -0.01em | `globals.css:22-23`, `EnergyTodayCard.tsx:180` |
| Cuerpo | Inter 400, `text-base` = 17 px | `globals.css:197-205` |
| UI | Inter entre `text-sm` y `text-xs` | `src/app/system-design/sections/typography.tsx:61` |
| Eyebrow | Inter 600, `text-xs`, mayúsculas, +0.06em | `EnergyTodayCard.tsx:157` |
| Prosa de escritor | Literata 1.0625rem, interlínea 1.85, justificada con sangría de libro | `globals.css:292-305` |

La landing usa la display a escala de marketing con `clamp` (por ejemplo `src/features/marketing/landing/LandingFinalCta.tsx:12`).

## Raíz, espaciado y contención

- La raíz es 17 px y todo va en rem, así que el texto y el táctil crecen con el tamaño de letra del sistema (`globals.css:195-199`, DECISIONS:49).
- Espaciado: la escala de Tailwind en múltiplos de 0.25rem (`src/app/system-design/sections/foundations.tsx:61`). Margen de pantalla 1.25rem en el teléfono y 2rem desde `md`, 1.25rem entre bloques de página (`PageWrapper.tsx:30`).
- Capas con nombre, cinco y nada suelto: base, raised, overlay, modal, toast (`globals.css:103-108`).

## Elevación y materiales

| Nivel | Claro | Oscuro |
|---|---|---|
| Superficie | `--sf` blanco sobre `--bg` teñido, con hairline | paso de tono a `--sf` |
| Elevada (card, menú, diálogo) | una sombra, `0 10px 30px` ink al 8% (`globals.css:101`) | ninguna: `--shadow: none` (`:189-190`) |
| Acento (acción primaria) | glow del acento al 35% (`:97`, `button.tsx:12`) | al 55% (`:186`) |
| Vidrio (barra inferior) | `--sf` al 84%, hairline al 8% (`:98-99`) | al 82%, hairline al 9% (`:187-188`), con `blur 1.4rem saturate 1.8` (`src/components/BottomNav.tsx:72`) |

La card es superficie con hairline y la sombra del token (`card.tsx:15`, criterio en `src/components/ui/superficies.test.tsx:1-7`). Diálogo y cajón van a 1.375rem con la misma sombra (`dialog.tsx:64`, `drawer.tsx:59`).

## Táctil y chrome

- El táctil mínimo es el botón por defecto, 2.85rem (48,5 px); la acción primaria `lg` mide 3.2rem (54,4 px) (`button.tsx:24-31`, criterio en `src/components/ui/acciones.test.tsx:1-6`). El campo mide lo mismo que el botón (`input.tsx:11`).
- La barra inferior flota a 0.9rem de los bordes, es un pill de vidrio con cuatro destinos de 3.6rem de alto y el orbe de crear aparte a 3.3rem (`BottomNav.tsx:69`, `:72`, `:89`, `:100`). Ninguno toca un borde (`src/app/system-design/sections/mobile.tsx:18`).
- `<main>` reserva el chrome inferior leyendo `--kino-bottom-chrome`, nunca un número (`globals.css:110-118` y `:168-172`).
- En móvil: `ResponsiveDialog`, sin arrastre en touch, acciones hover con `md:opacity-0` (`AGENTS.md:316`).

## Iconos

Una sola familia, lucide-react (`components.json:13`, `package.json:64`, `AGENTS.md:315`). Trazo 1.8 en reposo; el activo es el mismo glifo con relleno al 20% y trazo 2 (`BottomNav.tsx:108`). Tamaños: 1.25rem en botones (`button.tsx:8`), 1rem en menús y metadatos, 0.875rem en lo denso (`src/app/system-design/sections/icons.tsx:125`).

## Movimiento

- CSS puro: keyframes, transitions y Tailwind; Framer Motion no se instala (`AGENTS.md:306`).
- Se animan `transform`, `opacity` y color, nunca una propiedad de layout ni un desenfoque en bucle (`AGENTS.md:308`). Las primitivas declaran qué transicionan y no se añade `transition-all` (`AGENTS.md:311`, `button.tsx:8`).
- Los overlays entran en 100 ms con fundido y zoom desde 95 (`dialog.tsx:64`, `dropdown-menu.tsx:46`); la hoja lateral en 200 ms `ease-in-out` (`sheet.tsx:65`).
- `prefers-reduced-motion` lo apaga todo desde un bloque sobre `*`, a 0.01 ms y no a 0 para que `animationend` siga llegando (`globals.css:705-723`, `AGENTS.md:309`). Lo que corre en JavaScript pregunta por la preferencia por su cuenta, como la cuenta de la cota (`EnergyTodayCard.tsx:111`, `AGENTS.md:310`).
- El esqueleto no anima (DECISIONS:49).

## El catálogo vivo

`/system-design` (`src/app/system-design/`) es el specimen: todo cambio de UI se previsualiza ahí y añade el suyo (`AGENTS.md:317`). Secciones en `src/app/system-design/sections/`: foundations, colors, typography, icons, buttons, forms, overlays, mobile y las de cada pantalla. Se verifica mirando con `node scripts/capturas/run.mjs` a 393x852, 430x748, 1131x686 y 1440x900, claro y oscuro (`AGENTS.md:319`).

## Lo que el código todavía contradice

Hallazgos de esta lectura. Ninguno se corrige aquí: cada uno es un PR de UI con sus capturas.

- `src/app/layout.tsx:36-42` dice que `themeColor` son "los dos valores de `--background`", pero declara #ffffff y #161616, y `--bg` vale #f5f5f4 y #131211.
- La barra inferior lleva una sombra negra fija también en oscuro (`BottomNav.tsx:72`), donde la elevación es un paso de tono (`globals.css:189`).
- `xs` y `sm` del botón (2rem y 2.5rem, 34 y 42,5 px) quedan bajo el táctil de 48 (`button.tsx:28-29`).
- El hairline común es ink al 8% (`globals.css:95`); la gramática dice 6%.
- El copy visible de la cota usa el punto medio como separador (`EnergyTodayCard.tsx:153`, `:181`, `:187`), y la casa no lo usa.
- El catálogo describe una escala que ya no existe: "los radios derivan todos de --radius" (`foundations.tsx:21`) y "escala Tailwind por defecto" (`typography.tsx:61`).
- La energía baja es roja (`colors.tsx:186`), y el rojo está reservado a lo irreversible (DECISIONS:44).
- Ocho ficheros escriben neutros stock de Tailwind (`LinkedTaskCard.tsx`, `sticky-note-colors.ts`, `FolderCard.tsx`, `NotebookCard.tsx`, `QuickAccessCard.tsx`, `tag-colors.ts`, `NotebookTagPicker.tsx`, `NotebooksView.tsx`, más el gris de la paleta de sistema en `globals.css:8-10`). El hook bloquea la línea que los vuelva a escribir, y el cierre de turno avisa en cuanto se toca cualquiera de esos ficheros, porque relee el fichero entero.

## Taste ledger

Lo que ya está decidido, con su fuente. Una corrección nueva de Elias entra aquí en el mismo turno, con sus palabras y la fecha.

- La interfaz habla español (`src/app/layout.tsx:53`, `lang="es"`; `AGENTS.md` y el copy en español).
- La categoría es "instrumento", no plataforma ni app de productividad (título de `AGENTS.md` en el PR #180, abierto a 2026-10-16; DECISIONS:43 y :59). La voz de la landing la cierra la fase 12 (`scripts/check-voz.sh:83-84`).
- Sin guion largo en ningún sitio, ni en comentarios ni en Markdown (`scripts/check-voz.sh:57-65`), y sin punto medio en la prosa (regla de la casa; el PR #180 los retira de `AGENTS.md`).
- Sin emojis ni glifos decorativos: texto o iconos lucide (`AGENTS.md:315`, `scripts/check-voz.sh:67-74`).
- Kino no es sujeto: el producto le habla a la persona y la persona hace la acción (`scripts/check-voz.sh:76-80`).
- Cuatro palabras prohibidas en el copy: coach, productividad, asistente, detectamos (`scripts/check-voz.sh:93-102`).
- Ningún nombre de tipo en texto visible (`scripts/check-voz.sh:47-55`).
- El ámbar es el color primario ("quiero que ámbar sea el color primario", 2026-09-06, DECISIONS:44).
- La nota adhesiva se pega donde la pongas y ahí se queda ("la idea es que el sticky note sea lo más parecido a un sticky note en la vida real", 2026-09-15, DECISIONS:73).
- El acento señala y no decora; nada en bucle; sin gradiente de marca (DECISIONS:51).
- Hoy no pone una tarjeta antes de la cifra y nada vacío ocupa espacio (`src/app/(app)/dashboard/page.tsx:20-25`, DECISIONS:50).
