import { Button } from "@/components/ui/button";

export function PagesList() {
    return (
        <div className="w-full h-fit">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Notes</h2>
                <div className="flex gap-2">
                    <Button size="icon-lg" variant="default">+</Button>
                    <Button size="lg" variant="destructive">Delete</Button>
                </div>
            </div>
            <div className="w-full h-fit rounded-3xl border-2 border-gray-200">

            </div>
        </div>
    )
}