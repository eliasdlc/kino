'use client';

import { Fragment, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CLAUDE_ADD_CONNECTOR_URL,
  CLAUDE_CODE_COMMANDS,
  CODEX_COMMANDS,
  MCP_RESOURCE_URL,
} from '@/features/mcp/connect';
import { cuandoDe } from '@/features/tasks/item-events';
import { useAgentesConectados, useDesconectarAgente } from './settings.hooks';

/**
 * Cómo conectar a Kino el agente que ya usas, un cliente a la vez. Los
 * comandos y la dirección salen de `features/mcp/connect`, la misma fuente que
 * la documentación pública, para que las dos páginas no se contradigan.
 *
 * "Codex" a solas es el codex de entidades de Kino, así que el cliente de
 * OpenAI se llama "Codex de OpenAI" en todo texto visible.
 */

const CLIENTES = [
  { id: 'claude', nombre: 'Claude' },
  { id: 'claude-code', nombre: 'Claude Code' },
  { id: 'chatgpt', nombre: 'ChatGPT' },
  { id: 'codex', nombre: 'Codex de OpenAI' },
] as const;

type Conectado = NonNullable<ReturnType<typeof useAgentesConectados>['data']>['activos'][number];

const ALCANCE: Record<Conectado['scope'], string> = {
  read: 'Leer',
  propose: 'Proponer',
  write: 'Escribir',
};

const HORA = new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });
const DIA = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'long' });

/** "hoy a las 18:40", "ayer a la 1:05" o "el 3 de octubre a las 9:30". */
function cuandoSeCorto(ms: number, ahora = Date.now()) {
  const hora = HORA.format(ms);
  const aLas = `${hora.startsWith('1:') ? 'a la' : 'a las'} ${hora}`;
  const dia = (t: number) => new Date(t).toDateString();
  if (dia(ms) === dia(ahora)) return `hoy ${aLas}`;
  if (dia(ms) === dia(ahora - 86_400_000)) return `ayer ${aLas}`;
  return `el ${DIA.format(ms)} ${aLas}`;
}

const haceCuanto = (ms: number) => cuandoDe(new Date(ms).toISOString());

/**
 * La línea de cada pestaña: espera mientras ningún cliente de ese tipo ha
 * llamado y, cuando llega la primera llamada, cambia sola a la última. Si los
 * de ese tipo están todos desconectados, espera una llamada nueva. Mientras la
 * lista carga no pinta nada, para que "Esperando" no parpadee.
 */
function Espera({
  cliente,
  activos,
  revocados,
}: {
  cliente: (typeof CLIENTES)[number];
  activos: Conectado[] | undefined;
  revocados: Conectado[] | undefined;
}) {
  if (!activos || !revocados) return null;
  const ultimo = activos
    .filter((c) => c.kind === cliente.id)
    .reduce<Conectado | undefined>((a, c) => (a && a.lastSeenAt >= c.lastSeenAt ? a : c), undefined);
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      {ultimo
        ? `Última llamada de ${cliente.nombre} ${haceCuanto(ultimo.lastSeenAt)}. Lo ves en Conectados.`
        : `Esperando ${revocados.some((c) => c.kind === cliente.id) ? 'una llamada nueva' : 'la primera llamada'} de ${cliente.nombre}. Esta línea cambia sola cuando llegue.`}
    </p>
  );
}

/**
 * Los clientes que ya llamaron, activos primero. Desconectar corta al momento,
 * sin confirmar: el aviso dice qué recibe el cliente en su próxima llamada.
 */
function Conectados({
  activos,
  revocados,
}: {
  activos: Conectado[] | undefined;
  revocados: Conectado[] | undefined;
}) {
  const desconectar = useDesconectarAgente();
  return (
    <section aria-labelledby="agentes-conectados" className="space-y-2">
      <h3 id="agentes-conectados" className="text-sm font-semibold">
        Conectados
      </h3>
      {!activos || !revocados ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : activos.length + revocados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no ha llamado ninguno.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {activos.map((c) => (
            <li key={c._id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">
                  {ALCANCE[c.scope]}, última llamada {haceCuanto(c.lastSeenAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                disabled={desconectar.isPending && desconectar.variables?.id === c._id}
                onClick={() => desconectar.mutate({ id: c._id, label: c.label })}
              >
                Desconectar
              </Button>
            </li>
          ))}
          {revocados.map((c) => (
            <li key={c._id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.label}</p>
                <p className="text-xs text-muted-foreground">
                  Desconectado {cuandoSeCorto(c.revokedAt ?? c.lastSeenAt)}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">Revocado</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Copia al portapapeles y avisa del resultado; sin permiso, lo dice. */
async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(aviso);
  } catch {
    toast.error('No se pudo copiar. Selecciónalo y cópialo a mano.');
  }
}

/** Una tarjeta de pasos: el texto a copiar en un bloque, su botón y una nota. */
function Pasos({
  titulo,
  lineas,
  boton,
  aviso,
  nota,
  pie,
}: {
  titulo: string;
  lineas: readonly string[];
  boton: string;
  aviso: string;
  nota: string;
  pie?: ReactNode;
}) {
  return (
    <Card className="gap-3 px-4">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <pre className="space-y-0.5 overflow-x-auto rounded-xl border bg-background px-3 py-2.5 font-jetbrains text-xs">
        {lineas.map((linea) => (
          // Cada argumento va sin cortes, así la línea solo se parte en los
          // espacios y nunca después del guion de "--transport". La dirección
          // es la excepción: se parte por dentro solo si no cabe ni sola en
          // una línea, que pasa con el texto grande.
          <code key={linea} className="block whitespace-pre-wrap">
            {linea.split(' ').map((parte, i) => (
              <Fragment key={i}>
                {i > 0 && ' '}
                <span className={/^https?:\/\//.test(parte) ? 'wrap-anywhere' : 'whitespace-nowrap'}>
                  {parte}
                </span>
              </Fragment>
            ))}
          </code>
        ))}
      </pre>
      <div className="flex justify-end">
        <Button onClick={() => copiar(lineas.join('\n'), aviso)}>{boton}</Button>
      </div>
      <p className="text-sm text-muted-foreground">{nota}</p>
      {pie}
    </Card>
  );
}

export function AgentsSection() {
  const { data } = useAgentesConectados();
  const activos = data?.activos;
  const espera = (id: (typeof CLIENTES)[number]['id']) => (
    <Espera cliente={CLIENTES.find((c) => c.id === id)!} activos={activos} revocados={data?.revocados} />
  );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Agentes</h2>
        <p className="text-sm text-muted-foreground">
          Conecta Claude, ChatGPT o Codex de OpenAI. Entras con tu cuenta de Kino y lo
          autorizas; no hay claves que copiar.
        </p>
      </div>

      <Tabs defaultValue="claude-code" className="gap-3">
        {/* Cuatro nombres no caben en una fila a 393 px: dos por fila hasta `sm`.
            En la rejilla un nombre puede partirse en dos líneas con el texto
            grande, en vez de salirse de su celda. */}
        <TabsList className="group-data-horizontal/tabs:h-auto grid w-full grid-cols-2 rounded-[1.375rem] sm:flex sm:w-fit sm:rounded-full">
          {CLIENTES.map((cliente) => (
            <TabsTrigger
              key={cliente.id}
              value={cliente.id}
              className="h-auto min-h-[2.35rem] whitespace-normal text-center leading-tight sm:whitespace-nowrap"
            >
              {cliente.nombre}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="claude">
          <Card className="gap-3 px-4">
            <h3 className="text-sm font-semibold">Añade Kino desde Claude</h3>
            <p className="text-sm text-muted-foreground">
              Se abre Claude con el nombre y la dirección ya puestos. Revisa los datos y confirma.
              Se añade una vez y sirve en la web, en Claude Desktop, en el móvil y en Claude Code si
              entras con la misma cuenta. En un plan Team o Enterprise lo añade quien administra la
              organización.
            </p>
            <div className="flex justify-end">
              <Button asChild>
                <a href={CLAUDE_ADD_CONNECTOR_URL} target="_blank" rel="noreferrer">
                  Añadir Kino a Claude
                  <ExternalLink aria-hidden />
                </a>
              </Button>
            </div>
            {espera('claude')}
          </Card>
        </TabsContent>

        <TabsContent value="claude-code">
          <Pasos
            titulo="Ejecuta los dos comandos en tu terminal"
            lineas={CLAUDE_CODE_COMMANDS}
            boton="Copiar los dos"
            aviso="Comandos copiados"
            nota='El segundo abre el navegador para que autorices. Sin él, Claude Code se queda en "Needs authentication".'
            pie={espera('claude-code')}
          />
        </TabsContent>

        <TabsContent value="chatgpt">
          <Pasos
            titulo="Añade un servidor MCP personalizado"
            lineas={[MCP_RESOURCE_URL]}
            boton="Copiar la dirección"
            aviso="Dirección copiada"
            nota="Desde la configuración de ChatGPT, añade un servidor MCP personalizado y pega esta dirección. Depende de tu plan de ChatGPT."
            pie={espera('chatgpt')}
          />
        </TabsContent>

        <TabsContent value="codex">
          <Pasos
            titulo="Ejecuta los dos comandos en tu terminal"
            lineas={CODEX_COMMANDS}
            boton="Copiar los dos"
            aviso="Comandos copiados"
            nota="Sirven en la terminal, en el editor y en la app. El primero ya abre el navegador para que autorices; el segundo lo repite si lo cerraste."
            pie={espera('codex')}
          />
        </TabsContent>
      </Tabs>

      <Conectados activos={activos} revocados={data?.revocados} />
    </div>
  );
}
