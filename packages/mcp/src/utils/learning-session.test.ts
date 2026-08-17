import { describe, expect, it } from 'vitest';
import {
  parseLearningCheckpoint,
  renderLearningSessionDocument,
  updateLearningSessionDocument,
  type ResumeCheckpoint,
} from './learning-session.js';
import { htmlToMarkdown, markdownToHtml } from './markdown.js';

const initialCheckpoint: ResumeCheckpoint = {
  schemaVersion: 1,
  sessionId: '4f8f1f88-0d7c-4ce0-9665-f8d4a006e902',
  currentNodeId: 'vectors',
  lastUnderstood: 'A vector has magnitude and direction.',
  openQuestion: null,
  nextAction: 'Explain covectors with one concrete example.',
  suggestedMinutes: 8,
  learnerStateUpdatedAt: '2026-08-17T12:00:00.000Z',
};

describe('learning session document', () => {
  it('renders a checkpoint that can be recovered exactly', () => {
    const document = renderLearningSessionDocument({
      topic: 'Covectors',
      now: 'Connect a measurement to a vector.',
      why: 'This distinguishes vectors from covectors.',
      checkpoint: initialCheckpoint,
    });

    expect(parseLearningCheckpoint(document)).toEqual(initialCheckpoint);
    expect(document).toContain('## Ahora\n\nConnect a measurement to a vector.');
    expect(document).toContain('## Registro');
  });

  it('recovers the checkpoint after Kino stores and returns Tiptap HTML', () => {
    const document = renderLearningSessionDocument({
      topic: 'Covectors',
      now: 'Connect a measurement to a vector.',
      why: 'This distinguishes vectors from covectors.',
      checkpoint: initialCheckpoint,
    });
    const html = markdownToHtml(document);
    const recovered = htmlToMarkdown(html);

    expect(recovered).not.toBeNull();
    expect(parseLearningCheckpoint(recovered!)).toEqual(initialCheckpoint);
  });

  it('updates orientation and checkpoint without erasing the log', () => {
    const document = `${renderLearningSessionDocument({
      topic: 'Covectors',
      now: 'Old step',
      why: 'Old reason',
      checkpoint: initialCheckpoint,
    })}\n\n### probe | 2026-08-17T12:01:00.000Z\n\nLearner answer`;
    const checkpoint: ResumeCheckpoint = {
      ...initialCheckpoint,
      currentNodeId: 'linear-functionals',
      nextAction: 'Try one transfer check.',
      learnerStateUpdatedAt: '2026-08-17T12:02:00.000Z',
    };

    const updated = updateLearningSessionDocument(document, {
      now: 'Map a vector to a scalar.',
      why: 'This is the operational definition.',
      checkpoint,
    });

    expect(updated).toContain('## Ahora\n\nMap a vector to a scalar.');
    expect(updated).toContain('## Después\n\nTry one transfer check.');
    expect(updated).toContain('Learner answer');
    expect(parseLearningCheckpoint(updated)).toEqual(checkpoint);
  });

  it('rejects a page without a valid checkpoint', () => {
    expect(() => parseLearningCheckpoint('# Ordinary note')).toThrow(
      'does not contain a Kino learning checkpoint',
    );
  });
});
