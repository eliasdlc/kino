'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Progress } from '@/components/ui/progress';
import { StepHook } from './steps/StepHook';
import { StepIdentity } from './steps/StepIdentity';
import { StepChronotype } from './steps/StepChronotype';
import { StepSleep } from './steps/StepSleep';
import { StepRecharge, type RechargePreset } from './steps/StepRecharge';
import { StepHours } from './steps/StepHours';
import { StepFirstSystem } from './steps/StepFirstSystem';
import { StepPromise } from './steps/StepPromise';
import {
  getArchetype,
  seedUnitField,
  type ArchetypeIdentity,
} from './onboarding.archetypes';
import type { SeedUnitInput } from './onboarding.schemas';
import { TrackOnMount } from '@/shared/observability/TrackOnMount';
import { track } from '@/shared/observability/analytics.client';

type Chronotype = 'morning' | 'intermediate' | 'evening';

const TOTAL_STEPS = 8;

/**
 * Nombre de cada paso para la medición. El número que el ticket llama decisivo
 * es en cuál se cae la gente, y ese sólo sale instrumentando el avance: con el
 * principio y el final se sabe cuántos se pierden, no dónde.
 */
const STEP_NAMES = [
  'hook',
  'identity',
  'chronotype',
  'sleep',
  'recharge',
  'hours',
  'first_system',
  'promise',
] as const;

/**
 * Slots iniciales de siembra: uno por ejemplo declarado en el manifiesto, con el
 * campo extra (el medium de una obra) ya en su primera opción.
 */
function initialUnits(identity: ArchetypeIdentity): SeedUnitInput[] {
  const archetype = getArchetype(identity);
  const firstOption = seedUnitField(archetype)?.options?.[0]?.value;
  return archetype.seed.placeholders
    .slice(0, archetype.seed.maxUnits)
    .map(() => ({ name: '', ...(firstOption ? { field: firstOption } : {}) }));
}

export function OnboardingWizard({
  initialIdentity = null,
  segment = null,
}: {
  initialIdentity?: ArchetypeIdentity | null;
  /** Slug de la landing por la que se entró, ya validado. La dimensión del funnel. */
  segment?: string | null;
}) {
  const router = useRouter();
  const completeOnboarding = useMutation(api.onboarding.complete);
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<ArchetypeIdentity | null>(initialIdentity);
  const [chronotype, setChronotype] = useState<Chronotype>('intermediate');
  const [sleepHours, setSleepHours] = useState(7);
  const [rechargePresets, setRechargePresets] = useState<RechargePreset[]>([]);
  const [availableHours, setAvailableHours] = useState(8);
  const [systemName, setSystemName] = useState(
    initialIdentity ? getArchetype(initialIdentity).systemNameDefault : '',
  );
  const [units, setUnits] = useState<SeedUnitInput[]>(
    initialIdentity ? initialUnits(initialIdentity) : [],
  );

  // Cambiar de identidad rehace el sistema propuesto: el nombre y las unidades
  // pertenecen al arquetipo, no al usuario que todavía no los tocó.
  function chooseIdentity(next: ArchetypeIdentity) {
    if (next === identity) return;
    setIdentity(next);
    setSystemName(getArchetype(next).systemNameDefault);
    setUnits(initialUnits(next));
  }

  // Un evento por paso visto, no por render: sin el pestillo, cualquier cambio
  // de estado dentro de un paso lo contaría otra vez y el embudo se aplanaría.
  const trackedStep = useRef<number | null>(null);
  useEffect(() => {
    if (trackedStep.current === step) return;
    trackedStep.current = step;
    track('onboarding_step_viewed', {
      segment,
      step: STEP_NAMES[step],
      step_index: step,
    });
  }, [step, segment]);

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    if (!identity) return;
    setIsLoading(true);
    setError(null);
    try {
      await completeOnboarding({
        identity,
        chronotype,
        sleepTypicalHours: sleepHours,
        availableHoursPerDay: availableHours,
        rechargePresets,
        firstSystemName: systemName,
        seedUnits: units.filter((u) => u.name.trim().length > 0),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      track('onboarding_completed', { segment, identity });
      router.push('/dashboard');
    } catch {
      setIsLoading(false);
      setError('Algo salió mal, intenta de nuevo.');
    }
  }

  const progress = step === 0 ? 0 : Math.round((step / (TOTAL_STEPS - 1)) * 100);

  return (
    <div className="flex flex-col min-h-screen">
      <TrackOnMount event="onboarding_started" properties={{ segment }} />
      {step > 0 && (
        <div className="px-6 pt-6">
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {error && (
        <p className="px-6 pt-4 text-center text-sm text-destructive">{error}</p>
      )}

      <div className="flex-1 flex items-center justify-center p-6">
        {step === 0 && <StepHook onNext={next} />}
        {step === 1 && (
          <StepIdentity value={identity} onChange={chooseIdentity} onNext={next} onBack={back} />
        )}
        {step === 2 && (
          <StepChronotype value={chronotype} onChange={setChronotype} onNext={next} onBack={back} />
        )}
        {step === 3 && (
          <StepSleep value={sleepHours} onChange={setSleepHours} onNext={next} onBack={back} />
        )}
        {step === 4 && (
          <StepRecharge value={rechargePresets} onChange={setRechargePresets} onNext={next} onBack={back} />
        )}
        {step === 5 && (
          <StepHours value={availableHours} onChange={setAvailableHours} onNext={next} onBack={back} />
        )}
        {step === 6 && identity && (
          <StepFirstSystem
            identity={identity}
            name={systemName}
            onNameChange={setSystemName}
            units={units}
            onUnitsChange={setUnits}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 7 && identity && (
          <StepPromise
            identity={identity}
            systemName={systemName}
            units={units}
            onSubmit={submit}
            onBack={back}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
