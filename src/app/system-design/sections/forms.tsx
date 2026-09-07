"use client";

import { useState } from "react";
import { Section, SubSection, Specimen, SpecimenGrid } from "../helpers";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import { Search, ArrowRight } from "lucide-react";

export function FormsSection() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<string | undefined>("09:30");
  const [progress, setProgress] = useState(60);

  return (
    <Section
      id="formularios"
      number="06"
      title="Formularios"
      description="Inputs, selects, switches y pickers de fecha/hora. Todos comparten el mismo focus ring (ring-ring/50) y el estado aria-invalid destructivo."
    >
      <SubSection title="Input y Textarea">
        <SpecimenGrid cols={3}>
          <Specimen label="Default" hint="con Label asociado">
            <div className="w-full space-y-2">
              <Label htmlFor="ds-name">Nombre del sistema</Label>
              <Input id="ds-name" placeholder="Universidad" />
            </div>
          </Specimen>
          <Specimen label="Disabled">
            <div className="w-full space-y-2">
              <Label htmlFor="ds-dis">Campo bloqueado</Label>
              <Input id="ds-dis" disabled placeholder="No editable" />
            </div>
          </Specimen>
          <Specimen label="Inválido" hint="aria-invalid">
            <div className="w-full space-y-2">
              <Label htmlFor="ds-inv">Email</Label>
              <Input id="ds-inv" aria-invalid defaultValue="no-es-un-email" />
              <p className="text-xs text-destructive">Introduce un email válido.</p>
            </div>
          </Specimen>
          <Specimen label="Textarea">
            <Textarea placeholder="Descripción de la tarea…" className="w-full" />
          </Specimen>
          <Specimen label="Textarea disabled">
            <Textarea disabled placeholder="Bloqueada" className="w-full" />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="InputGroup"
        description="Input con addons: iconos, texto o botones pegados al campo."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Icono inicial" hint="patrón de búsqueda">
            <InputGroup className="w-full">
              <InputGroupAddon>
                <Search className="size-4" />
              </InputGroupAddon>
              <InputGroupInput placeholder="Buscar tareas…" />
            </InputGroup>
          </Specimen>
          <Specimen label="Texto addon">
            <InputGroup className="w-full">
              <InputGroupInput placeholder="mi-workspace" />
              <InputGroupAddon align="inline-end">
                <InputGroupText>.kino.app</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Specimen>
          <Specimen label="Con botón">
            <InputGroup className="w-full">
              <InputGroupInput placeholder="Añadir rápido…" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton aria-label="Enviar">
                  <ArrowRight />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Select">
        <SpecimenGrid cols={3}>
          <Specimen label="Default">
            <Select defaultValue="medium">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Prioridad</SelectLabel>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Specimen>
          <Specimen label="Placeholder">
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige un sistema…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uni">Universidad</SelectItem>
                <SelectItem value="side">Side project</SelectItem>
              </SelectContent>
            </Select>
          </Specimen>
          <Specimen label="Disabled">
            <Select disabled>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Bloqueado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="x">—</SelectItem>
              </SelectContent>
            </Select>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Switch, Slider y Progress">
        <SpecimenGrid cols={3}>
          <Specimen label="Switch" hint="off · on · disabled">
            <Switch aria-label="Apagado" />
            <Switch defaultChecked aria-label="Encendido" />
            <Switch disabled aria-label="Deshabilitado" />
          </Specimen>
          <Specimen label="Slider" hint="controla el Progress de al lado">
            <Slider
              value={[progress]}
              onValueChange={([v]) => setProgress(v)}
              max={100}
              step={5}
              className="w-full"
            />
          </Specimen>
          <Specimen label="Progress" hint={`value={${progress}}`}>
            <Progress value={progress} className="w-full" />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Fecha y hora"
        description="Calendar (react-day-picker) y TimePicker propio. La convención de fechas es timestamptz con hora opcional (project-date-convention)."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Calendar" hint="selección simple">
            <Calendar mode="single" selected={date} onSelect={setDate} />
          </Specimen>
          <Specimen label="TimePicker" hint='value="09:30"'>
            <TimePicker value={time} onChange={setTime} />
          </Specimen>
          <Specimen label="TimePicker disabled">
            <TimePicker disabled />
          </Specimen>
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}
