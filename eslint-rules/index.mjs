// Reglas locales de Kino con baseline congelado.
//
// `baseline.json` guarda, por regla y por fichero, cuántas violaciones había el
// día que la regla se encendió. Un fichero que sube de su cifra falla (violación
// nueva); uno que baja también falla, con la cifra a la que hay que bajar, así
// que el baseline sólo puede encogerse. Se cuenta por fichero y no por línea
// para que mover código no lo rompa.
//
// Un sitio con `// eslint-disable-next-line <regla> -- <motivo>` no se cuenta:
// ESLint ya lo calla, y esa es la forma de dejar escrito el motivo.
import { readFileSync } from "node:fs";
import path from "node:path";

const FEATURES = path.resolve("src/features");
const BASELINE_FILE = path.resolve("eslint-rules/baseline.json");

function loadBaseline() {
  // KINO_BASELINE_OFF=1 lo vacía: lo usa `update-baseline.mjs` para contar.
  if (process.env.KINO_BASELINE_OFF) return {};
  return JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
}

const baseline = loadBaseline();

function relativeFile(filename) {
  return path.relative(process.cwd(), filename).split(path.sep).join("/");
}

/** Reporta los sitios de un fichero contra su baseline. */
function createFrozen(ruleName, collect, messages) {
  return {
    meta: {
      type: "problem",
      schema: [],
      messages: {
        ...messages,
        lower: `Bajaste las violaciones de \`${ruleName}\` en este fichero: baja su baseline en eslint-rules/baseline.json a {{count}} (o quita la entrada si es 0). El baseline sólo puede encogerse.`,
      },
    },
    create(context) {
      const file = relativeFile(context.filename);
      const allowed = baseline[ruleName]?.[file] ?? 0;
      const sites = [];
      const visitors = collect(context, (node, data) => sites.push({ node, data }));
      return {
        ...visitors,
        "Program:exit"(program) {
          if (sites.length > allowed) {
            for (const { node, data } of sites) {
              context.report({
                node,
                messageId: "violation",
                data: { ...data, count: sites.length, allowed },
              });
            }
          } else if (sites.length < allowed) {
            context.report({ node: program, messageId: "lower", data: { count: sites.length } });
          }
        },
      };
    },
  };
}

function sliceOf(absolutePath) {
  const relative = path.relative(FEATURES, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return relative.split(path.sep)[0];
}

function resolveSource(source, filename) {
  if (source.startsWith("@/")) return path.resolve("src", source.slice(2));
  if (source.startsWith(".")) return path.resolve(path.dirname(filename), source);
  return null;
}

const noCrossSliceImport = createFrozen(
  "kino/no-cross-slice-import",
  (context, add) => {
    const from = sliceOf(context.filename);
    if (!from) return {};
    const check = (node) => {
      const source = node.source?.value;
      if (typeof source !== "string") return;
      const target = resolveSource(source, context.filename);
      const to = target && sliceOf(target);
      if (to && to !== from) add(node.source, { from, to });
    };
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression(node) {
        if (node.source.type === "Literal") check({ source: node.source });
      },
    };
  },
  {
    violation:
      "Un slice no importa de otro ('{{from}}' importa de '{{to}}'). Mueve lo compartido a `src/shared` (a `convex/lib` si es de servidor) e impórtalo de ahí. Este fichero tiene {{count}} imports cruzados y su baseline permite {{allowed}}.",
  },
);

const collectNeedsReason = createFrozen(
  "kino/collect-needs-reason",
  (_context, add) => ({
    CallExpression(node) {
      const callee = node.callee;
      if (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.name === "collect" &&
        node.arguments.length === 0
      ) {
        add(node, {});
      }
    },
  }),
  {
    violation:
      "`.collect()` lee todo el rango y cada escritura relee la suscripción. Acota con un índice y rango (`.withIndex(...)`, `.take(n)` o `.paginate`), o deja el motivo con `// eslint-disable-next-line kino/collect-needs-reason -- <motivo>`. Este fichero tiene {{count}} y su baseline permite {{allowed}}.",
  },
);

const plugin = {
  rules: {
    "no-cross-slice-import": noCrossSliceImport,
    "collect-needs-reason": collectNeedsReason,
  },
};

export default plugin;
