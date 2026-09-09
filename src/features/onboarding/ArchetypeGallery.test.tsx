import { useState } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderMobile } from '@/shared/testing/render';
import { SYSTEM_TYPE_CONFIG, type SystemType } from '@/shared/lib/system-types';
import { ArchetypeGallery } from './ArchetypeGallery';
import { DEFAULT_IDENTITY, type ArchetypeIdentity } from './onboarding.archetypes';

/**
 * La única pregunta del alta. Lo que se prueba aquí no es que se pinten seis
 * cosas: es que las seis salen del manifiesto, de modo que añadir un arquetipo
 * no obligue a tocar el componente ni este test.
 */

/** Los arquetipos que se pueden elegir: todos menos Bandeja, que se crea sola. */
const ELEGIBLES = (Object.keys(SYSTEM_TYPE_CONFIG) as SystemType[]).filter((t) => t !== 'inbox');

function Controlada({ initial = DEFAULT_IDENTITY }: { initial?: ArchetypeIdentity }) {
  const [value, setValue] = useState<ArchetypeIdentity>(initial);
  return <ArchetypeGallery value={value} onChange={setValue} />;
}

describe('ArchetypeGallery', () => {
  it('pinta una fila por arquetipo del manifiesto, y Bandeja no está', () => {
    renderMobile(<Controlada />);

    const filas = screen.getAllByRole('radio');
    // La cuenta se deriva del manifiesto: cuando crezca, este test sigue siendo
    // cierto sin que nadie lo edite, que es exactamente la propiedad que pide.
    expect(filas).toHaveLength(ELEGIBLES.length);
    for (const type of ELEGIBLES) {
      expect(screen.getByText(SYSTEM_TYPE_CONFIG[type].label)).toBeInTheDocument();
    }
    expect(screen.queryByText(SYSTEM_TYPE_CONFIG.inbox.label)).not.toBeInTheDocument();
  });

  it('dice los sustantivos con los que habla cada arquetipo, leídos del manifiesto', () => {
    renderMobile(<Controlada />);

    for (const type of ELEGIBLES) {
      expect(screen.getByText(SYSTEM_TYPE_CONFIG[type].vocabulary.join(', '))).toBeInTheDocument();
    }
  });

  it('la fila entera es la acción: elegir cambia la marcada y no hay dos', async () => {
    const user = userEvent.setup();
    renderMobile(<Controlada />);

    const escritura = screen.getByRole('radio', { name: /Escritura/ });
    expect(escritura).toHaveAttribute('aria-checked', 'false');

    await user.click(escritura);

    expect(escritura).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });

  it('llega con una elegida, así que nadie mira un botón apagado', () => {
    renderMobile(<Controlada />);

    const marcadas = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(marcadas).toHaveLength(1);
  });

  it('la lista se desplaza sola en vez de empujar el botón fuera de la pantalla', () => {
    renderMobile(<Controlada />);

    // Con la letra del sistema en grande, seis filas no caben en 852 px. Lo que
    // no puede pasar es que se cronometre el scroll buscando "Entrar".
    expect(screen.getByRole('radiogroup')).toHaveClass('overflow-y-auto');
  });

  it('avisa de la elección una sola vez por fila tocada', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMobile(<ArchetypeGallery value="propio" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /Académico/ }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('estudiante');
  });
});
