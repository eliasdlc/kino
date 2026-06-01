'use server';

import { auth } from "@/auth";
import { headers } from "next/headers";
import { getAllTasks } from "./tasks.queries";

export async function getAllTasksAction() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new Error("Unauthorized");

    return await getAllTasks(session.user.id);
}