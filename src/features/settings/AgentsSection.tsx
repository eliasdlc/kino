'use client';

import { Fragment } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CLAUDE_ADD_CONNECTOR_URL,
  CLAUDE_CODE_COMMANDS,
  CODEX_COMMANDS,
  MCP_RESOURCE_URL,
} from '@/features/mcp/connect';

/**
 * Cómo conectar a Kino el agente que ya usas, un cliente a la vez, dentro de
 * la hoja «Agentes» de Ajustes (el título y la explicación son de la hoja). Los
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
}: {
  titulo: string;
  lineas: readonly string[];
  boton: string;
  aviso: string;
  nota: string;
}) {
  return (
    <div className="space-y-3">
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
    </div>
  );
}

export function AgentsSection() {
  return (
    <div>
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
          <div className="space-y-3">
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
          </div>
        </TabsContent>

        <TabsContent value="claude-code">
          <Pasos
            titulo="Ejecuta los dos comandos en tu terminal"
            lineas={CLAUDE_CODE_COMMANDS}
            boton="Copiar los dos"
            aviso="Comandos copiados"
            nota='El segundo abre el navegador para que autorices. Sin él, Claude Code se queda en "Needs authentication".'
          />
        </TabsContent>

        <TabsContent value="chatgpt">
          <Pasos
            titulo="Añade un servidor MCP personalizado"
            lineas={[MCP_RESOURCE_URL]}
            boton="Copiar la dirección"
            aviso="Dirección copiada"
            nota="Desde la configuración de ChatGPT, añade un servidor MCP personalizado y pega esta dirección. Depende de tu plan de ChatGPT."
          />
        </TabsContent>

        <TabsContent value="codex">
          <Pasos
            titulo="Ejecuta los dos comandos en tu terminal"
            lineas={CODEX_COMMANDS}
            boton="Copiar los dos"
            aviso="Comandos copiados"
            nota="Sirven en la terminal, en el editor y en la app. El primero ya abre el navegador para que autorices; el segundo lo repite si lo cerraste."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
