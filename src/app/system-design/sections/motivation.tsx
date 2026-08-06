"use client";

import { useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { Flame, PartyPopper, Target } from "lucide-react";
import { Section, SubSection, Specimen, SpecimenGrid, Seeded, ClientOnly } from "../helpers";
import { MOCK_SYSTEM_ID, MOCK_FOLDER_ID, makeWritingOverview, makeWorkJournal } from "../mock-data";
import { Button } from "@/components/ui/button";
import { WritingPulse } from "@/features/writing/WritingPulse";
import { WorkJournalDialog } from "@/features/writing/WorkJournalDialog";
import { celebrate } from "@/features/writing/celebrate";
import { writingKeys } from "@/features/writing/writing.hooks";
import type { WritingOverview } from "@/features/writing/writing.types";

/**
 * El panel de motivación de escritura (PLAN-11 W4).
 *
 * `WritingPulse` decide qué decir con la hora local actual, así que sus specimens
 * van dentro de `ClientOnly`: aquí el cache está sembrado antes del primer render
 * y sin el guard el servidor y el cliente pueden discrepar de hora y romper la
 * hidratación. Es un artefacto del catálogo, no del componente.
 *
 * Los hitos del diario son todos derivados — ninguno se guarda como tal.
 */

function seedOverview(overview: WritingOverview) {
  return (qc: QueryClient) => {
    qc.setQueryData(writingKeys.overview(MOCK_SYSTEM_ID), overview);
  };
}

function PulseSpecimen({ overview }: { overview: WritingOverview }) {
  return (
    <ClientOnly>
      <Seeded seed={seedOverview(overview)}>
        <div className="w-full">
          <WritingPulse systemId={MOCK_SYSTEM_ID} />
        </div>
      </Seeded>
    </ClientOnly>
  );
}

/** El diario solo pinta con `open`, así que el specimen trae su propio disparador. */
function JournalSpecimen() {
  const [open, setOpen] = useState(false);
  const journal = makeWorkJournal();

  return (
    <Seeded
      seed={(qc) => {
        qc.setQueryData(writingKeys.journal(MOCK_FOLDER_ID), journal);
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Abrir diario de la obra
      </Button>
      <WorkJournalDialog
        folderId={MOCK_FOLDER_ID}
        folderName={journal.folderName}
        open={open}
        onOpenChange={setOpen}
      />
    </Seeded>
  );
}

export function MotivationSection() {
  return (
    <Section id="motivacion" number="17" title="Motivación de escritura">
      <SubSection
        title="WritingPulse"
        description="Racha, meta diaria y ventana creativa. Sin curva aprendida no inventa una hora: dice qué le falta."
      >
        {/* Dos columnas y no tres: a ~300px el mensaje del advisor se parte a una
            palabra por línea y el specimen deja de parecerse a lo que ve el autor,
            que lo tiene en el ancho del panel de escritura. */}
        <SpecimenGrid cols={2}>
          <Specimen label="Racha viva, dentro de la ventana" hint="streakIncludesToday: true">
            <PulseSpecimen overview={makeWritingOverview()} />
          </Specimen>

          <Specimen label="Racha en riesgo" hint="aún no ha escrito hoy">
            <PulseSpecimen
              overview={makeWritingOverview({
                streakIncludesToday: false,
                wordsToday: 0,
                currentHour: 16,
              })}
            />
          </Specimen>

          <Specimen label="Meta diaria cumplida" hint="wordsToday ≥ dailyWordGoal">
            <PulseSpecimen overview={makeWritingOverview({ wordsToday: 1_240 })} />
          </Specimen>

          <Specimen label="Sin ventana aprendida" hint="peakWindow: null">
            <PulseSpecimen
              overview={makeWritingOverview({ peakWindow: null, streakDays: 0, wordsToday: 0 })}
            />
          </Specimen>

          <Specimen label="Sin meta configurada" hint="dailyWordGoal: null">
            <PulseSpecimen overview={makeWritingOverview({ dailyWordGoal: null })} />
          </Specimen>

          <Specimen label="Fuera de la ventana" hint="currentHour fuera de peakWindow">
            <PulseSpecimen overview={makeWritingOverview({ currentHour: 22 })} />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Celebraciones"
        description="Toast propio, no el genérico. Se dispara una sola vez por sesión para que no se vuelva ruido."
      >
        <SpecimenGrid>
          <Specimen label="Meta diaria" hint="celebrate({ icon: Target })">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                celebrate({
                  icon: Target,
                  title: "Meta diaria cumplida",
                  detail: "1.000 palabras. La obra va por 24.310.",
                })
              }
            >
              Disparar
            </Button>
          </Specimen>

          <Specimen label="Racha" hint="celebrate({ icon: Flame })">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                celebrate({ icon: Flame, title: "12 días seguidos", detail: "Tu racha más larga." })
              }
            >
              Disparar
            </Button>
          </Specimen>

          <Specimen label="Capítulo terminado" hint="sin detail">
            <Button
              variant="outline"
              size="sm"
              onClick={() => celebrate({ icon: PartyPopper, title: "Capítulo 1 terminado" })}
            >
              Disparar
            </Button>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Diario de la obra"
        description="Sesiones por día con sus hitos. Todos derivados sobre la línea base: ninguno se persiste como hito."
      >
        <Specimen label="Diario con hitos" hint="WorkJournalDialog">
          <JournalSpecimen />
        </Specimen>
      </SubSection>
    </Section>
  );
}
