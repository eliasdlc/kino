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
      description="El campo y el select son pastillas de 2.85rem, la altura del botón, con el hairline fuerte; el área de texto es superficie de 1.125rem. Todos comparten el único foco visible (focus-ring) y el estado aria-invalid en carmesí. El interruptor y el pulgar del slider amplían su zona de toque a 2.85rem sin agrandar el dibujo."
    >
      <SubSection title="Input y Textarea">
        <SpecimenGrid cols={3}>
          <Specimen label="Normal" hint="con Label asociado">
            <div className="w-full space-y-2">
              <Label htmlFor="ds-name">Nombre del sistema</Label>
              <Input id="ds-name" placeholder="Universidad" />
            </div>
          </Specimen>
          <Specimen label="Deshabilitado">
            <div className="w-full space-y-2">
              <Label htmlFor="ds-dis">Campo bloqueado</Label>
              <Input id="ds-dis" disabled placeholder="No editable" />
            </div>
          </Specimen>
          <Specimen label="Inválido" hint="aria-invalid: borde carmesí y siempre un mensaje debajo, el color solo no basta">
            <div className="w-full space-y-2">
              <Label htmlFor="ds-inv">Email</Label>
              <Input id="ds-inv" aria-invalid defaultValue="no-es-un-email" />
              <p className="text-xs text-destructive">Introduce un email válido.</p>
            </div>
          </Specimen>
          <Specimen label="Área de texto">
            <Textarea placeholder="Descripción de la tarea" className="w-full" />
          </Specimen>
          <Specimen label="Área deshabilitada">
            <Textarea disabled placeholder="Bloqueada" className="w-full" />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="InputGroup"
        description="Campo con addons: iconos, texto o botones pegados al campo. El botón de dentro mide 2.85rem en el teléfono y encoge desde md."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Icono inicial" hint="patrón de búsqueda">
            <InputGroup className="w-full">
              <InputGroupAddon>
                <Search className="size-4" />
              </InputGroupAddon>
              <InputGroupInput placeholder="Buscar tareas" />
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
              <InputGroupInput placeholder="Añadir rápido" />
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
          <Specimen label="Normal">
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
          <Specimen label="Sin valor">
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige un sistema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uni">Universidad</SelectItem>
                <SelectItem value="side">Side project</SelectItem>
              </SelectContent>
            </Select>
          </Specimen>
          <Specimen label="Deshabilitado">
            <Select disabled>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Bloqueado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="x">Ninguno</SelectItem>
              </SelectContent>
            </Select>
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection title="Switch, Slider y Progress">
        <SpecimenGrid cols={3}>
          <Specimen label="Interruptor" hint="apagado, encendido, deshabilitado; zona de toque 2.85rem, pulgar con hairline">
            <Switch aria-label="Apagado" />
            <Switch defaultChecked aria-label="Encendido" />
            <Switch disabled aria-label="Deshabilitado" />
          </Specimen>
          <Specimen label="Deslizador" hint="pista de 2.85rem de alto; controla el progreso de al lado">
            <Slider
              value={[progress]}
              onValueChange={([v]) => setProgress(v)}
              max={100}
              step={5}
              className="w-full"
            />
          </Specimen>
          <Specimen label="Progreso" hint={`value={${progress}}`}>
            <Progress value={progress} className="w-full" />
          </Specimen>
        </SpecimenGrid>
      </SubSection>

      <SubSection
        title="Fecha y hora"
        description="Calendar (react-day-picker) con celdas de 2.85rem en el teléfono y 2rem desde md; TimePicker propio sobre Command. La fecha es un instante con hora opcional."
      >
        <SpecimenGrid cols={3}>
          <Specimen label="Calendario" hint="selección simple; el día enfocado con flechas lleva el anillo">
            <Calendar mode="single" selected={date} onSelect={setDate} />
          </Specimen>
          <Specimen label="Hora" hint='TimePicker, value="09:30"'>
            <TimePicker value={time} onChange={setTime} />
          </Specimen>
          <Specimen label="Hora deshabilitada">
            <TimePicker disabled />
          </Specimen>
        </SpecimenGrid>
      </SubSection>
    </Section>
  );
}
