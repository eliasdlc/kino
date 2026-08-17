import { z } from 'zod';
export const resumeCheckpointSchema = z.object({
    schemaVersion: z.literal(1),
    sessionId: z.string().uuid(),
    currentNodeId: z.string().min(1),
    lastUnderstood: z.string(),
    openQuestion: z.string().nullable(),
    nextAction: z.string().min(1),
    suggestedMinutes: z.number().int().min(1).max(90),
    learnerStateUpdatedAt: z.iso.datetime({ offset: true }),
});
const checkpointBlockPattern = /## Checkpoint\s+```json\s*([\s\S]*?)\s*```/;
export function renderLearningSessionDocument({ topic, now, why, checkpoint, }) {
    return `# ${topic.trim()}

> Kino learning session v1. Session ID: ${checkpoint.sessionId}

## Ahora

${now.trim()}

## Por qué

${why.trim()}

## Después

${checkpoint.nextAction.trim()}

## Checkpoint

\`\`\`json
${JSON.stringify(checkpoint, null, 2)}
\`\`\`

## Registro`;
}
export function parseLearningCheckpoint(markdown) {
    const match = markdown.match(checkpointBlockPattern);
    if (!match?.[1]) {
        throw new Error('This page does not contain a Kino learning checkpoint.');
    }
    let parsed;
    try {
        parsed = JSON.parse(match[1]);
    }
    catch {
        throw new Error('The Kino learning checkpoint contains invalid JSON.');
    }
    return resumeCheckpointSchema.parse(parsed);
}
function replaceSection(markdown, heading, content) {
    const pattern = new RegExp(`## ${heading}[^\\n]*\\n[\\s\\S]*?(?=\\n## |$)`);
    if (!pattern.test(markdown)) {
        throw new Error(`The learning session is missing the ${heading} section.`);
    }
    return markdown.replace(pattern, `## ${heading}\n\n${content.trim()}\n`);
}
export function updateLearningSessionDocument(markdown, input) {
    let updated = replaceSection(markdown, 'Ahora', input.now);
    updated = replaceSection(updated, 'Por qué', input.why);
    updated = replaceSection(updated, 'Después', input.checkpoint.nextAction);
    if (!checkpointBlockPattern.test(updated)) {
        throw new Error('This page does not contain a Kino learning checkpoint.');
    }
    return updated.replace(checkpointBlockPattern, `## Checkpoint\n\n\`\`\`json\n${JSON.stringify(input.checkpoint, null, 2)}\n\`\`\``);
}
