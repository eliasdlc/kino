"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Tabbed content for system detail view.
 * Avoids the long vertical scroll of all three sections stacked.
 */
export function TasksFunnelTabs() {
    return (
        <Tabs defaultValue="action" className="w-full">
            <TabsList>
                <TabsTrigger value="planning">Plannig</TabsTrigger>
                <TabsTrigger value="action">Action</TabsTrigger>
                <TabsTrigger value="archive">Archive</TabsTrigger>
            </TabsList>

            <TabsContent value="planning" className="mt-4">
                {/*<TaskPlanningView />*/}
                <p>Planning</p>
            </TabsContent>

            <TabsContent value="action" className="mt-4">
                {/*<TaskActionView />*/}
                <p>Action</p>
            </TabsContent>

            <TabsContent value="archive" className="mt-4">
                {/*<TaskArchiveView />*/}
                <p>Archive</p>
            </TabsContent>
        </Tabs>
    );
}
