'use server';
import { db } from "@/shared/db";
import { tasks } from "@/shared/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function getAllTasks(userId: string){
    return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)))
}