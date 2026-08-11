'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

type Chronotype = 'morning' | 'intermediate' | 'evening';

const TOTAL_STEPS = 8;

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
}: {
  initialIdentity?: ArchetypeIdentity | null;
}) {
  const router = useRouter();
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
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity,
          chronotype,
          sleepTypicalHours: sleepHours,
          availableHoursPerDay: availableHours,
          rechargePresets,
          firstSystemName: systemName,
          seedUnits: units.filter((u) => u.name.trim().length > 0),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      router.push('/dashboard');
    } catch {
      setIsLoading(false);
      setError('Algo salió mal, intenta de nuevo.');
    }
  }

  const progress = step === 0 ? 0 : Math.round((step / (TOTAL_STEPS - 1)) * 100);

  return (
    <div className="flex flex-col min-h-screen">
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
