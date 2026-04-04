import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateSystemDialog } from "./CreateSystemDialog";
import { SystemsList } from "./SystemsList";

export default function SystemsPage() {


  return (
    <div className="p-4 flex flex-col gap-2 bg-white w-full h-full">
      <h2 className="text-2xl font-bold">Systems</h2>
      <div className="w-full flex flex-row gap-2">
        <Input className="w-1/2" placeholder="Search System" />
        <CreateSystemDialog />
        <Button>Filter Systems</Button>
      </div>
      <SystemsList />

    </div>
  )
}
