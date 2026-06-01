"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { TaskCard } from "./TaskCard"; 
import { TaskCardSkeleton } from "@/components/skeletons";
import { getAllTasksAction } from "./tasks.actions";
import { useQuery } from "@tanstack/react-query";

export  function AllTasksList() {
    const [searchQuery, setSearchQuery] = useState("");
    const { data: tasks = [], isLoading, isError } = useQuery({
        queryKey: ["tasks", "all"],
        queryFn: () => getAllTasksAction(),
    });
    
    const dueTasks = tasks.filter((task) => (!task.completedAt && task.parentTaskId === null));

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                    <TaskCardSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (isError) {
        return <div>Error loading tasks</div>;
    }


    return (
        <div className="space-y-4">
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                className="pl-9" 
                placeholder="Search tasks..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            {dueTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-12 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                        No tasks found.
                    </p>
                </div>
            ) : (   
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dueTasks.map((task) => (
                    <TaskCard key={task.id} task={task} systemId="all-tasks" onToggle={() => {}} onDelete={() => {}} />
                ))}
            </div>
            )}
        </div>
    )
}