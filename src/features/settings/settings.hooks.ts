import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAction, useConvex, useConvexAuth } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useConvexMutation, useConvexQuery, useLocalMutation } from '@/shared/convex/hooks';
import { enPantalla } from '@/features/connections/providers';
import { downloadBlob } from '@/shared/utils/download';
import { NOMBRE_FUENTE } from './settings-copy';

export function useUserSettings() {
  return useConvexQuery(api.settings.get, {});
}

/**
 * El contrato de guardado de Ajustes: todo guarda al tocar. No hay aviso de
 * éxito, porque el control ya enseña el valor nuevo y deshacer es volver a
 * tocarlo; un toast por cada paso del límite o cada opción del tema sería
 * ruido. Sólo se avisa cuando no se guardó, y entonces el control vuelve al
 * valor de la cuenta.
 */
export function useUpdateUserSettings() {
  return useConvexMutation(api.settings.update, {
    onError: () => toast.error('No se pudieron guardar los ajustes'),
  });
}

/**
 * El perfil de energía con el mismo contrato que el resto de Ajustes: cada
 * campo se guarda al tocarlo y sin toast de éxito. Es la única escritura del
 * perfil desde que Ajustes dejó el formulario con botón Guardar.
 */
export function useSaveEnergyProfile() {
  return useConvexMutation(api.energy.updateProfile, {
    onError: () => toast.error('No se pudo guardar tu perfil de energía'),
  });
}

/**
 * Genera y descarga el ZIP de datos del workspace.
 *
 * Es una mutación y no una query porque el usuario la dispara y porque el
 * `isPending` es la mitad del valor: recorrer las veintidós tablas tarda, y sin
 * señal de progreso la gente vuelve a pulsar y encadena invocaciones caras.
 *
 * Las imágenes viajan en su propio ZIP (`useExportImages`): juntas ya no caben
 * en el presupuesto de la ruta.
 */
export function useExportWorkspace() {
  return useLocalMutation(
    async () => {
      const res = await fetch('/api/export/workspace');
      if (!res.ok) throw new Error('No se pudo generar el export');
      // Una tabla que llegó al tope viaja recortada, y decirlo aquí es mejor
      // que dejar que se descubra comparando el JSON con la app.
      const recortadas = res.headers.get('X-Kino-Truncated') ?? 'none';
      downloadBlob(await res.blob(), 'kino-workspace.zip');
      return { recortadas: recortadas === 'none' ? [] : recortadas.split(',') };
    },
    {
      onSuccess: ({ recortadas }) => {
        if (recortadas.length > 0) {
          toast.warning(`El export salió recortado en: ${recortadas.join(', ')}. El manifiesto del ZIP lo dice.`);
          return;
        }
        toast.success('Export listo');
      },
      onError: () => {
        toast.error('No se pudo generar el export');
      },
    },
  );
}

/** El segundo ZIP: las imágenes, para descomprimir al lado del de datos. */
export function useExportImages() {
  return useLocalMutation(
    async () => {
      const res = await fetch('/api/export/images');
      if (!res.ok) throw new Error('No se pudieron bajar las imágenes');
      // El export nunca falla por una imagen: las que no cupieron en el
      // presupuesto se quedan apuntando a su URL remota, y avisarlo es
      // preferible a que se descubra abriendo el ZIP.
      const skipped = Number(res.headers.get('X-Kino-Images-Skipped') ?? 0);
      downloadBlob(await res.blob(), 'kino-imagenes.zip');
      return { skipped };
    },
    {
      onSuccess: ({ skipped }) => {
        if (skipped > 0) {
          toast.warning(
            `${skipped} ${skipped === 1 ? 'imagen quedó fuera' : 'imágenes quedaron fuera'} del ZIP y siguen apuntando a su URL original.`,
          );
          return;
        }
        toast.success('Imágenes listas');
      },
      onError: () => {
        toast.error('No se pudieron bajar las imágenes');
      },
    },
  );
}

/** Los agentes que ya llamaron a Kino con esta cuenta: activos y revocados. */
export function useAgentesConectados() {
  return useConvexQuery(api.mcpClients.list, {});
}

/**
 * Corta un agente conectado. El nombre viaja junto al id solo para el aviso:
 * la mutación recibe el id.
 */
export function useDesconectarAgente() {
  return useConvexMutation(api.mcpClients.desconectar, {
    map: ({ id }: { id: Id<'mcpClients'>; label: string }) => ({ id }),
    onSuccess: (_, { label }) =>
      toast.success(`${label} desconectado. Su próxima llamada recibe "acceso revocado desde Kino".`),
    onError: () => toast.error('No se pudo desconectar. Inténtalo otra vez.'),
  });
}

/** Las fuentes conectadas que se pintan: las que el servidor conoce y tienen código que responde. */
export function useFuentes() {
  const { data } = useConvexQuery(api.connections.list, {});
  return data?.filter((fuente) => enPantalla(fuente.provider));
}

/**
 * Una respuesta por cliente: que la integración de GitHub esté configurada es
 * cosa del despliegue y no cambia mientras la página vive, así que la fila del
 * índice y la hoja comparten la misma pregunta.
 */
const configuracionPorCliente = new WeakMap<object, Promise<boolean>>();

/**
 * Si este despliegue tiene la integración de GitHub, sólo cuando hace falta
 * saberlo: con `consultar` en false (la cuenta ya está enlazada) no se
 * pregunta nada. Sin cuenta enlazada la acción responde sin hablar con
 * GitHub, porque no hay token que validar. Un fallo cuenta como configurada:
 * el panel de GitHub dice entonces su propio error.
 */
export function useGithubConfigurado(consultar: boolean): boolean | undefined {
  const convex = useConvex();
  const status = useAction(api.github.status);
  const { isAuthenticated } = useConvexAuth();
  const [configurado, setConfigurado] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!consultar || !isAuthenticated) return;
    let vivo = true;
    let pregunta = configuracionPorCliente.get(convex);
    if (!pregunta) {
      pregunta = status({}).then(
        (r) => r.configured,
        () => true,
      );
      configuracionPorCliente.set(convex, pregunta);
    }
    void pregunta.then((valor) => {
      if (vivo) setConfigurado(valor);
    });
    return () => {
      vivo = false;
    };
  }, [consultar, isAuthenticated, convex, status]);

  return consultar ? configurado : undefined;
}

/** El estado de una fuente, el mismo en la fila del índice y en la hoja. */
export type EstadoFuente = 'conectada' | 'sin-conectar' | 'no-disponible';

/**
 * El estado de GitHub para Ajustes: conectada, sin conectar, o no disponible
 * en este despliegue. undefined mientras no se sabe. La fila del índice y la
 * hoja salen de aquí, así que no pueden decir cosas distintas.
 */
export function useEstadoGithub(): EstadoFuente | undefined {
  const github = useFuentes()?.find((f) => f.provider === 'github');
  const configurado = useGithubConfigurado(github !== undefined && !github.connected);
  if (!github) return undefined;
  if (github.connected) return 'conectada';
  if (configurado === undefined) return undefined;
  return configurado ? 'sin-conectar' : 'no-disponible';
}

const TEXTO_ESTADO: Record<EstadoFuente, string> = {
  conectada: 'conectada',
  'sin-conectar': 'sin conectar',
  'no-disponible': 'no disponible aquí',
};

/**
 * La meta de la fila de Conexiones. Sale de la misma lista que la hoja y del
 * mismo estado de GitHub, así que la fila nunca invita a conectar lo que la
 * hoja no deja conectar.
 */
export function useConnectionsMeta(): string | undefined {
  const fuentes = useFuentes();
  const github = useEstadoGithub();
  if (!fuentes) return undefined;
  if (fuentes.length === 0) return 'Ninguna fuente disponible';
  const partes: string[] = [];
  for (const fuente of fuentes) {
    const nombre = NOMBRE_FUENTE[fuente.provider] ?? fuente.provider;
    if (fuente.provider === 'github') {
      if (github === undefined) return undefined;
      partes.push(`${nombre}, ${TEXTO_ESTADO[github]}`);
    } else {
      partes.push(`${nombre}, ${fuente.connected ? 'conectada' : 'sin conectar'}`);
    }
  }
  return partes.join('; ');
}
