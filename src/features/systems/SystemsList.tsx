'use client'
import { Button } from "@/components/ui/button";
import { useSystems } from "./systems.hooks";
import Link from "next/link";

export function SystemsList() {
  const { data: systems, isLoading, isError } = useSystems();

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error al cargar los sistemas. Intenta de nuevo.</div>;


  return (
    <div className="pt-4 flex flex-cols gap-4">
      {systems?.map((system) => (
        <div key={system.id} className="flex flex-row gap-4 border-2 rounded-3xl p-4  aspect-square ">
          <p>{system.name}</p>
          <p>{system.templateType}</p>
          <p>{system.isActive ? "Active" : "Inactive"}</p>
          <Button>Edit</Button>
          <Button>Delete</Button>
          <Link href={`/systems/${system.id}`}>
            <Button >View</Button>
          </Link>
        </div>
      ))}
    </div>
  );
}
