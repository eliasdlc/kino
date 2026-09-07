#!/usr/bin/env node
/**
 * Da densidad a la cuenta sembrada del deployment de dev, para que las
 * capturas enseñen lo que rompe un layout: títulos largos, vencidas, epics
 * con subtareas, carpetas anidadas, páginas con contenido y un codex.
 *
 *   set -a; . ~/.config/secretos/kino.env; set +a   # CONVEX_DEPLOY_KEY
 *   node scripts/capturas/sembrar.mjs
 *
 * Escribe por las mismas mutaciones que usa la app (`npx convex run` con la
 * identidad de Clerk de la cuenta), así que todo pasa por sus validaciones.
 * Es idempotente por nombre: si el sistema de escritura ya existe no hace nada.
 */

import { execFileSync } from "node:child_process";

const CLERK_ID = process.env.KINO_CLERK_ID ?? "user_3IqfSToAdAfTq2erTC9a4wNDZhx";
const IDENTITY = JSON.stringify({ subject: CLERK_ID, issuer: "https://clerk.dev" });
const NOVELA = "Novela · La casa de las cotas";

function run(fn, args) {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args), "--identity", IDENTITY], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const json = out.trim().split("\n").filter((l) => !l.includes("Warning")).join("\n");
  return JSON.parse(json);
}

function dia(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

const sistemas = run("systems:list", {});
const lista = Array.isArray(sistemas) ? sistemas : (sistemas.items ?? []);
if (lista.some((s) => s.name === NOVELA)) {
  console.log("La cuenta ya está sembrada.");
  process.exit(0);
}
const academico = lista.find((s) => s.templateType === "academic");
if (!academico) throw new Error("La cuenta no tiene sistema académico");
const A = academico.id ?? academico._id;

// Carpetas del semestre: dos clases y un laboratorio anidado.
const calculo = run("folders:create", { systemId: A, name: "Cálculo III", color: "blue", metadata: { professor: "Prof. Rosario Almonte", schedule: "Lun y Mié 8:00 a 9:40" } });
const so = run("folders:create", { systemId: A, name: "Sistemas Operativos", color: "orange", metadata: { professor: "Prof. Yamil Peña", schedule: "Mar y Jue 10:00 a 11:40" } });
const lab = run("folders:create", { systemId: A, name: "Laboratorio de kernel", color: "teal", parentId: so.id ?? so._id });

// Ocho etiquetas de contexto.
const etiquetas = {};
for (const [title, color] of [["lectura", "blue"], ["examen", "red"], ["entrega", "orange"], ["grupo", "purple"], ["laboratorio", "teal"], ["repaso", "green"], ["proyecto", "yellow"], ["consulta", "pink"]]) {
  const t = run("tags:create", { title, color, systemId: A });
  etiquetas[title] = t.id ?? t._id;
}

const largo =
  "Terminar la demostración del teorema de Green para la región anular y comparar el resultado con la integral de línea calculada a mano en la clase del miércoles, incluyendo el caso degenerado en que la curva interior colapsa a un punto y anotando por qué el signo cambia";

const tareas = [
  { title: largo, status: "today", energyLevel: "high", priority: "critical", dueDate: dia(-5), estimatedTime: "02:30", folderId: calculo.id ?? calculo._id, contextTagId: etiquetas.entrega },
  { title: "Leer el capítulo 4 de Tanenbaum: planificación de procesos", status: "today", energyLevel: "medium", priority: "high", estimatedTime: "01:00", folderId: so.id ?? so._id, contextTagId: etiquetas.lectura },
  { title: "Repasar límites dobles antes del parcial", status: "today", energyLevel: "low", priority: "medium", estimatedTime: "00:45", folderId: calculo.id ?? calculo._id, contextTagId: etiquetas.repaso },
  { title: "Entregar el informe del laboratorio 3 (ya vencido)", status: "week", energyLevel: "medium", priority: "critical", dueDate: dia(-2), folderId: lab.id ?? lab._id, contextTagId: etiquetas.laboratorio },
  { title: "Parcial de Cálculo III", taskType: "event", status: "week", startDate: dia(2), dueDate: dia(2), energyLevel: "high", priority: "critical", metadata: { eventSubtype: "exam" }, folderId: calculo.id ?? calculo._id, contextTagId: etiquetas.examen },
  { title: "Reunión del grupo para repartir el proyecto final", taskType: "event", status: "tomorrow", startDate: dia(1), energyLevel: "medium", folderId: so.id ?? so._id, contextTagId: etiquetas.grupo },
  { title: "Preguntar en consulta por la nota del quiz 2", taskType: "reminder", status: "week", dueDate: dia(3), energyLevel: "low", contextTagId: etiquetas.consulta },
  { title: "Implementar el scheduler round robin del laboratorio", status: "week", energyLevel: "high", priority: "high", estimatedTime: "04:00", folderId: lab.id ?? lab._id, contextTagId: etiquetas.laboratorio },
  { title: "Resumen semanal de lecturas", status: "backlog", recurrenceRule: "FREQ=WEEKLY;BYDAY=FR", energyLevel: "low", contextTagId: etiquetas.lectura },
  { title: "Idea: hacer un cheat sheet de integrales de superficie", taskType: "idea", status: "backlog", energyLevel: "low", folderId: calculo.id ?? calculo._id },
  { title: "Buscar el paper original de Dijkstra sobre semáforos", status: "backlog", energyLevel: "medium", folderId: so.id ?? so._id, contextTagId: etiquetas.lectura },
  { title: "Comprar cuaderno cuadriculado", status: "backlog", energyLevel: "low" },
];
const creadas = run("tasks:bulkCreate", { tasks: tareas.map((t) => ({ systemId: A, ...t })) });

// Un epic con tres subtareas, para la jerarquía.
const epic = run("tasks:create", { systemId: A, title: "Proyecto final de Sistemas Operativos: un sistema de archivos en memoria", taskType: "epic", status: "week", energyLevel: "high", priority: "high", dueDate: dia(20), folderId: so.id ?? so._id, contextTagId: etiquetas.proyecto });
const epicId = epic.id ?? epic._id;
run("tasks:bulkCreate", {
  tasks: [
    { systemId: A, title: "Diseñar la tabla de inodos", parentTaskId: epicId, status: "week", energyLevel: "high", estimatedTime: "03:00" },
    { systemId: A, title: "Escribir las operaciones de lectura y escritura", parentTaskId: epicId, status: "backlog", energyLevel: "high" },
    { systemId: A, title: "Pruebas con archivos de 1 MB y 100 MB", parentTaskId: epicId, status: "backlog", energyLevel: "medium" },
  ],
});

// Un sistema de escritura: obra, capítulos, páginas con contenido y codex.
const novela = run("systems:create", { name: NOVELA, templateType: "writing", color: "purple", icon: "book", identityStatement: "Escribo mil palabras antes de que el día me alcance.", energyIdeal: "high", expectedFrequency: "daily" });
const W = novela.id ?? novela._id;
const obra = run("folders:create", { systemId: W, name: "Primera parte: la subida", color: "purple", metadata: { wordGoal: 80000 } });
const obraId = obra.id ?? obra._id;
const capitulos = run("folders:create", { systemId: W, name: "Capítulos 1 a 5", color: "pink", parentId: obraId });

const parrafo = (n) =>
  `<p>La cota del día marcaba ${n} y nadie en la casa sabía leerla salvo Inés, que la había aprendido de su abuela en las tardes en que el pueblo entero subía a la loma a esperar la niebla. Sabía que el número no medía la altura sino la distancia entre lo que uno podía hacer y lo que iba a hacer de todos modos.</p><p>Esa mañana el instrumento estaba torcido. Lo supo antes de mirarlo, por el modo en que el perro se negó a salir al patio y por el silencio de la cocina, donde su padre solía golpear la cafetera contra el fregadero para despertar a los demás.</p>`;
const paginas = [
  { title: "Capítulo 1: El instrumento torcido", content: `<h2>Uno</h2>${parrafo(134)}<h3>Notas de la escena</h3><ul><li>Inés no sabe todavía que el abuelo lo torció a propósito.</li><li>Plantar la cafetera: vuelve en el capítulo 9.</li><li>Ritmo: tres frases cortas después de la revelación.</li></ul>${parrafo(120)}` },
  { title: "Capítulo 2: La niebla que no bajó", content: `<h2>Dos</h2>${parrafo(98)}${parrafo(77)}<blockquote>La niebla no falta, decía la abuela. Somos nosotros los que llegamos tarde.</blockquote>${parrafo(61)}` },
  { title: "Capítulo 3: Lo que dijo el perro", content: `<h2>Tres</h2>${parrafo(45)}<p>Un capítulo corto, a propósito. Termina con la puerta abierta.</p>` },
];
for (const p of paginas) run("pages:create", { systemId: W, folderId: capitulos.id ?? capitulos._id, ...p });
run("pages:create", { systemId: W, title: "Biblia de la novela: reglas del mundo", content: `<h2>Reglas</h2><ol><li>La cota se lee una vez al día y no se discute.</li><li>Nadie sube a la loma solo.</li><li>El instrumento se hereda por línea materna.</li></ol>${parrafo(200)}` });

for (const e of [
  { type: "character", name: "Inés Almánzar", summary: "Diecisiete años. La única de la casa que sabe leer la cota.", aliases: ["Ine", "la nieta"] },
  { type: "character", name: "Don Fermín", summary: "El padre. Golpea la cafetera contra el fregadero cada mañana." },
  { type: "character", name: "La abuela Rosaura", summary: "Muerta antes de empezar la novela; aparece en lo que dijo." },
  { type: "location", name: "La loma de la niebla", summary: "Donde el pueblo entero sube a esperar." },
  { type: "location", name: "La casa de las cotas", summary: "Tres cuartos, un patio, un instrumento torcido." },
  { type: "object", name: "El instrumento", summary: "Mide la distancia entre lo que uno puede hacer y lo que hará de todos modos." },
]) run("entities:create", { systemId: W, ...e });

run("tasks:bulkCreate", {
  tasks: [
    { systemId: W, title: "Reescribir la apertura del capítulo 1 sin el clima", status: "today", energyLevel: "high", priority: "high", estimatedTime: "01:30", folderId: obraId },
    { systemId: W, title: "Decidir si Don Fermín sabe leer la cota", status: "week", energyLevel: "medium", folderId: obraId },
    { systemId: W, title: "Mil palabras del capítulo 4", status: "backlog", recurrenceRule: "FREQ=DAILY", energyLevel: "high", folderId: obraId },
  ],
});

console.log(`Sembrado: 3 carpetas, 8 etiquetas, ${creadas.length + 4} tareas y un epic en "${academico.name}"; "${NOVELA}" con 2 carpetas, 4 páginas, 6 entidades y 3 tareas.`);
