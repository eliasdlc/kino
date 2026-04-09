'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { colorEnum, energyLevelEnum, frequencyEnum, templateTypeEnum } from "@/shared/db/schema";
import type { CreateSystemInput } from "./systems.types";
import { useCreateSystem } from "./systems.hooks";

export function CreateSystemDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState<CreateSystemInput["color"]>("blue");
    const [templateType, setTemplateType] = useState<CreateSystemInput["templateType"]>("custom");
    const [energyIdeal, setEnergyIdeal] = useState<CreateSystemInput["energyIdeal"]>("medium");
    const [expectedFrequency, setExpectedFrequency] = useState<CreateSystemInput["expectedFrequency"]>("daily");
    const [triggerContext, setTriggerContext] = useState("");
    const [error, setError] = useState<string | null>(null);

    const { mutate: createSystem, isPending } = useCreateSystem();

    function resetForm() {
        setName("");
        setDescription("");
        setColor("blue");
        setTemplateType("custom");
        setEnergyIdeal("medium");
        setExpectedFrequency("daily");
        setTriggerContext("");
        setError(null);
    }

    function handleCreateSystem() {
        if (!name.trim()) return;

        const data: CreateSystemInput = {
            name: name.trim(),
            identityStatement: description,
            color,
            icon: "folder",
            templateType,
            energyIdeal,
            expectedFrequency,
            triggerContext,
        };

        createSystem(data, {
            onSuccess: () => {
                resetForm();
                setOpen(false);
            },
            onError: (err) => {
                setError(err.message ?? "Error al crear el sistema");
            },
        });
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full">+ Nuevo sistema</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader className="flex flex-col gap-4">
                    <DialogTitle>Nuevo sistema</DialogTitle>
                    <DialogDescription>
                        Crea un sistema para organizar tus tareas y hábitos.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

                <Label>Nombre</Label>
                <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />

                <Label>Descripción</Label>
                <Input placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />

                <Label>Color</Label>
                <Select value={color} onValueChange={(val) => setColor(val as CreateSystemInput["color"])}>
                    <SelectTrigger>
                        <SelectValue placeholder="Color" />
                    </SelectTrigger>
                    <SelectContent>
                        {colorEnum.enumValues.map((c) => (
                            <SelectItem value={c} key={c}>{c}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Label>Tipo de plantilla</Label>
                <Select value={templateType} onValueChange={(val) => setTemplateType(val as CreateSystemInput["templateType"])}>
                    <SelectTrigger>
                        <SelectValue placeholder="Tipo de plantilla" />
                    </SelectTrigger>
                    <SelectContent>
                        {templateTypeEnum.enumValues.map((t) => (
                            <SelectItem value={t} key={t}>{t}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Label>Nivel de energía ideal</Label>
                <Select value={energyIdeal} onValueChange={(val) => setEnergyIdeal(val as CreateSystemInput["energyIdeal"])}>
                    <SelectTrigger>
                        <SelectValue placeholder="Energía ideal" />
                    </SelectTrigger>
                    <SelectContent>
                        {energyLevelEnum.enumValues.map((e) => (
                            <SelectItem value={e} key={e}>{e}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Label>Frecuencia esperada</Label>
                <Select value={expectedFrequency} onValueChange={(val) => setExpectedFrequency(val as CreateSystemInput["expectedFrequency"])}>
                    <SelectTrigger>
                        <SelectValue placeholder="Frecuencia" />
                    </SelectTrigger>
                    <SelectContent>
                        {frequencyEnum.enumValues.map((f) => (
                            <SelectItem value={f} key={f}>{f}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Label>Contexto activador</Label>
                <Input placeholder="Ej: Al levantarme, al sentirme estresado..." value={triggerContext} onChange={(e) => setTriggerContext(e.target.value)} />

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
                    <Button onClick={handleCreateSystem} disabled={!name.trim() || isPending}>
                        {isPending ? "Creando..." : "Crear"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
