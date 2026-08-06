import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_ARCHETYPES,
  identityFromLandingSlug,
} from '@/features/onboarding/onboarding.archetypes';
import {
  LANDING_SEGMENTS,
  SEGMENT_SLUGS,
  getSegment,
  otherSegments,
  segmentRegisterHref,
} from './segments.manifest';

/**
 * El manifiesto de segmentos es contenido, pero sostiene un contrato: el slug de
 * la URL, el `landingSlug` de la identidad y el `?para=` que llega al onboarding
 * tienen que ser la misma cadena. Si se desalinean, la landing sigue pintándose
 * — y el usuario cae en un onboarding que le vuelve a preguntar quién es.
 */
describe('manifiesto de segmentos', () => {
  it('cubre los tres segmentos de la fase y no repite slugs', () => {
    expect(SEGMENT_SLUGS).toEqual(['estudiantes', 'escritores', 'builders']);
    expect(new Set(SEGMENT_SLUGS).size).toBe(SEGMENT_SLUGS.length);
  });

  it('cada slug resuelve a la identidad que declara', () => {
    for (const segment of LANDING_SEGMENTS) {
      expect(identityFromLandingSlug(segment.slug)).toBe(segment.identity);
    }
  });

  it('coincide con el landingSlug declarado por el manifiesto de identidad', () => {
    for (const segment of LANDING_SEGMENTS) {
      expect(ONBOARDING_ARCHETYPES[segment.identity].landingSlug).toBe(segment.slug);
    }
  });

  it('el CTA lleva el segmento hasta el registro', () => {
    for (const segment of LANDING_SEGMENTS) {
      const href = segmentRegisterHref(segment);
      expect(href).toBe(`/register?para=${segment.slug}`);
      // Lo que el registro reenvía al onboarding tiene que seguir resolviendo.
      const slug = new URL(href, 'https://kino.app').searchParams.get('para');
      expect(identityFromLandingSlug(slug)).toBe(segment.identity);
    }
  });

  it('getSegment devuelve null para lo que no existe', () => {
    expect(getSegment('estudiantes')?.identity).toBe('estudiante');
    expect(getSegment('emprendedores')).toBeNull();
    expect(getSegment('')).toBeNull();
  });

  it('los enlaces cruzados excluyen la landing actual y cubren el resto', () => {
    for (const segment of LANDING_SEGMENTS) {
      const others = otherSegments(segment.slug);
      expect(others).toHaveLength(LANDING_SEGMENTS.length - 1);
      expect(others.map((o) => o.slug)).not.toContain(segment.slug);
    }
  });

  it('reusa el icono de la identidad en vez de mantener una tabla propia', () => {
    for (const segment of LANDING_SEGMENTS) {
      expect(segment.icon).toBe(ONBOARDING_ARCHETYPES[segment.identity].icon);
    }
  });

  it('cada segmento trae el contenido completo que la página pinta', () => {
    for (const segment of LANDING_SEGMENTS) {
      const textos = [
        segment.navLabel,
        segment.audience,
        segment.metaTitle,
        segment.metaDescription,
        segment.eyebrow,
        segment.headline.lead,
        segment.headline.accent,
        segment.headline.tail,
        segment.subheadline,
        segment.heroCta,
        segment.painsTitle,
        segment.painsLead,
        segment.featuresTitle,
        segment.featuresLead,
        segment.energyTitle,
        segment.energyBody,
        segment.closingTitle,
        segment.closingBody,
        segment.ctaLabel,
      ];
      for (const texto of textos) expect(texto.trim().length).toBeGreaterThan(0);

      expect(segment.pains.length).toBeGreaterThanOrEqual(3);
      expect(segment.features.length).toBeGreaterThanOrEqual(3);
      for (const feature of segment.features) {
        expect(feature.title.trim().length).toBeGreaterThan(0);
        expect(feature.body.trim().length).toBeGreaterThan(0);
        expect(feature.proof.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('todas cierran con el diferenciador común de energía', () => {
    for (const segment of LANDING_SEGMENTS) {
      expect(segment.energyTitle).toBe('Y además entiende tu energía');
      // El cierre no es decorativo: explica el reparto pico/valle con el
      // vocabulario del segmento. Sin eso es una promesa vacía.
      expect(segment.energyBody.toLowerCase()).toContain('pico');
    }
  });

  it('el metadata cabe en un resultado de búsqueda', () => {
    for (const segment of LANDING_SEGMENTS) {
      expect(segment.metaTitle.length).toBeLessThanOrEqual(70);
      expect(segment.metaDescription.length).toBeGreaterThanOrEqual(80);
      expect(segment.metaDescription.length).toBeLessThanOrEqual(180);
    }
  });
});
