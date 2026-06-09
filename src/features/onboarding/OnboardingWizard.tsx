'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { StepHook } from './steps/StepHook';
import { StepChronotype } from './steps/StepChronotype';
import { StepSleep } from './steps/StepSleep';
import { StepRecharge, type RechargePreset } from './steps/StepRecharge';
import { StepHours } from './steps/StepHours';
import { StepFirstSystem } from './steps/StepFirstSystem';
import { StepPromise } from './steps/StepPromise';

type Chronotype = 'morning' | 'intermediate' | 'evening';

const TOTAL_STEPS = 7;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [chronotype, setChronotype] = useState<Chronotype>('intermediate');
  const [sleepHours, setSleepHours] = useState(7);
  const [rechargePresets, setRechargePresets] = useState<RechargePreset[]>([]);
  const [availableHours, setAvailableHours] = useState(8);
  const [systemName, setSystemName] = useState('');

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chronotype,
          sleepTypicalHours: sleepHours,
          availableHoursPerDay: availableHours,
          rechargePresets,
          firstSystemName: systemName,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      router.push('/dashboard');
    } catch {
      setIsLoading(false);
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

      <div className="flex-1 flex items-center justify-center p-6">
        {step === 0 && <StepHook onNext={next} />}
        {step === 1 && (
          <StepChronotype value={chronotype} onChange={setChronotype} onNext={next} onBack={back} />
        )}
        {step === 2 && (
          <StepSleep value={sleepHours} onChange={setSleepHours} onNext={next} onBack={back} />
        )}
        {step === 3 && (
          <StepRecharge value={rechargePresets} onChange={setRechargePresets} onNext={next} onBack={back} />
        )}
        {step === 4 && (
          <StepHours value={availableHours} onChange={setAvailableHours} onNext={next} onBack={back} />
        )}
        {step === 5 && (
          <StepFirstSystem value={systemName} onChange={setSystemName} onNext={next} onBack={back} />
        )}
        {step === 6 && (
          <StepPromise
            systemName={systemName}
            onSubmit={submit}
            onBack={back}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
