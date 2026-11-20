// Cuenta las violaciones actuales de las reglas con baseline y escribe
// `baseline.json`. Se corrió una vez al encenderlas. Después sólo se usa para
// bajar cifras (la regla avisa cuando toca); nunca para subirlas.
//   KINO_BASELINE_OFF=1 node eslint-rules/update-baseline.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";

process.env.KINO_BASELINE_OFF = "1";
const eslint = new ESLint();
const results = await eslint.lintFiles(["src", "convex"]);
const baseline = {};
for (const result of results) {
  for (const message of result.messages) {
    if (!message.ruleId?.startsWith("kino/") || message.messageId === "lower") continue;
    const file = path.relative(process.cwd(), result.filePath).split(path.sep).join("/");
    baseline[message.ruleId] ??= {};
    baseline[message.ruleId][file] = (baseline[message.ruleId][file] ?? 0) + 1;
  }
}
const sorted = Object.fromEntries(
  Object.entries(baseline)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rule, files]) => [rule, Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))]),
);
writeFileSync("eslint-rules/baseline.json", JSON.stringify(sorted, null, 2) + "\n");
for (const [rule, files] of Object.entries(sorted)) {
  console.log(rule, Object.values(files).reduce((a, b) => a + b, 0), "sitios en", Object.keys(files).length, "ficheros");
}
