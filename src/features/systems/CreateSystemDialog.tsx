'use client'

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { colorEnum, energyLevelEnum, frequencyEnum, templateTypeEnum } from "@/shared/db/schema";
import { CreateSystemInput } from "./systems.types";
import { useQueryClient } from "@tanstack/react-query";

export function CreateSystemDialog() {
    const queryClient = useQueryClient();

    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState("blue");
    const [icon] = useState("folder");
    const [templateType, setTemplateType] = useState("custom");
    const [energyIdeal, setEnergyIdeal] = useState("medium");
    const [expectedFrequency, setExpectedFrequency] = useState("daily");
    const [triggerContext, setTriggerContext] = useState("");



    const handleCreateSystem = async () => {
        const data: CreateSystemInput = {
            name,
            identityStatement: description,
            color: color as CreateSystemInput["color"],
            icon,
            templateType: templateType as CreateSystemInput["templateType"],
            energyIdeal: energyIdeal as CreateSystemInput["energyIdeal"],
            expectedFrequency: expectedFrequency as CreateSystemInput["expectedFrequency"],
            triggerContext,
        }

        const body = await fetch("/api/systems", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        })

        if (!body.ok) {
            throw new Error("Failed to create system");
        }

        const result = await body.json();
        console.log(result);
        queryClient.invalidateQueries({ queryKey: ["systems"] })
        setOpen(false);
    }


    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full">+ Nuevo sistema</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader className="flex flex-col gap-4">
                    <DialogTitle>Add System</DialogTitle>

                    <DialogDescription>
                        Add a new system to help you organize your life.
                    </DialogDescription>
                </DialogHeader>

                <Label>Name</Label>
                <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}></Input>

                <Label>Description</Label>
                <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)}></Input>

                <Label>Color</Label>
                <Select value={color} onValueChange={setColor}>
                    <SelectTrigger>
                        <SelectValue placeholder="Color" />
                    </SelectTrigger>
                    <SelectContent>
                        {colorEnum.enumValues.map((color) => (
                            <SelectItem value={color} key={color}>
                                {color}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Label>Icon</Label>


                <Label>Template Type</Label>
                <Select value={templateType} onValueChange={setTemplateType}>
                    <SelectTrigger>
                        <SelectValue placeholder="Template Type" />
                    </SelectTrigger>
                    <SelectContent>
                        {templateTypeEnum.enumValues.map((templateType) => (
                            <SelectItem value={templateType} key={templateType}>
                                {templateType}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Label>Energy Ideal</Label>
                <Select value={energyIdeal} onValueChange={setEnergyIdeal}>
                    <SelectTrigger>
                        <SelectValue placeholder="Energy Ideal" />
                    </SelectTrigger>
                    <SelectContent>
                        {energyLevelEnum.enumValues.map((energyLevel) => (
                            <SelectItem value={energyLevel} key={energyLevel}>
                                {energyLevel}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Label>Expected Frequency</Label>
                <Select value={expectedFrequency} onValueChange={setExpectedFrequency}>
                    <SelectTrigger>
                        <SelectValue placeholder="Expected Frequency" />
                    </SelectTrigger>
                    <SelectContent>
                        {frequencyEnum.enumValues.map((frequency) => (
                            <SelectItem value={frequency} key={frequency}>
                                {frequency}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Label>Trigger Context</Label>
                <Input placeholder="Ex: When I wake up, When I go to bed, When I feel stressed." value={triggerContext} onChange={(e) => setTriggerContext(e.target.value)}></Input>

                <DialogFooter>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={() => handleCreateSystem()}>Create</Button>
                </DialogFooter>
            </DialogContent>



        </Dialog>
    )
}