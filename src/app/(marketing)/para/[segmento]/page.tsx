import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingNav } from "@/features/marketing/MarketingNav";
import {
  SegmentCta,
  SegmentEnergy,
  SegmentFeatures,
  SegmentHero,
  SegmentPains,
  SegmentSwitch,
} from "@/features/marketing/segments/SegmentSections";
import { LANDING_SEGMENTS, getSegment } from "@/features/marketing/segments/segments.manifest";
import { TrackOnMount } from "@/shared/observability/TrackOnMount";

/**
 * Landing por arquetipo (D14). Una ruta, tres páginas: el contenido sale del
 * manifiesto de segmentos, así que añadir un segmento no toca este archivo.
 * Estáticas y prerenderizadas: son la puerta de entrada indexable de cada
 * segmento, no una vista de app.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return LANDING_SEGMENTS.map((s) => ({ segmento: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segmento: string }>;
}): Promise<Metadata> {
  const { segmento } = await params;
  const segment = getSegment(segmento);
  if (!segment) return {};

  const url = `/para/${segment.slug}`;
  return {
    title: segment.metaTitle,
    description: segment.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: segment.metaTitle,
      description: segment.metaDescription,
      siteName: "Kino",
      locale: "es_ES",
    },
    twitter: {
      card: "summary_large_image",
      title: segment.metaTitle,
      description: segment.metaDescription,
    },
  };
}

export default async function SegmentLandingPage({
  params,
}: {
  params: Promise<{ segmento: string }>;
}) {
  const { segmento } = await params;
  const segment = getSegment(segmento);
  if (!segment) notFound();

  return (
    <>
      <TrackOnMount event="segment_landing_viewed" properties={{ segment: segment.slug }} />
      <MarketingNav variant="segment" segmentSlug={segment.slug} />
      <SegmentHero segment={segment} />
      <SegmentPains segment={segment} />
      <SegmentFeatures segment={segment} />
      <SegmentEnergy segment={segment} />
      <SegmentCta segment={segment} />
      <SegmentSwitch segment={segment} />
    </>
  );
}
