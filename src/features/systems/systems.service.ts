import { db } from "@/shared/db";
import { CreateSystemInput, System, UpdateSystemInput } from "./systems.types"
import { systems } from "@/shared/db/schema";
import { and, eq, max } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@/shared/utils/error";

export async function createInboxForUser(userId: string) {

    await db.insert(systems).values({
        userId,
        name: "Inbox",
        isInbox: true,
        color: "blue",
        icon: "inbox",
        sortOrder: 0,
        templateType: "inbox"
    }).onConflictDoNothing();
}

export async function assertNotInbox(system: System) {
    if (system.isInbox) {
        throw new Error("INBOX_PROTECTED: Cannot modify or delete the Inbox system");
    }
}

export async function geyUsersSystems(userId: string) {
    return db.select()
        .from(systems)
        .where(
            and(
                eq(systems.userId, userId),
                eq(systems.isActive, true)
            )
        ).orderBy(systems.sortOrder);

}
export async function createSystem(userId: string, input: CreateSystemInput) {
    const [{ maxOrder }] = await db
        .select({ maxOrder: max(systems.sortOrder) })
        .from(systems)
        .where(eq(systems.userId, userId));

    const [created] = await db.insert(systems).values({
        userId,
        name: input.name,
        color: input.color ?? "blue",
        identityStatement: input.identityStatement,
        templateType: input.templateType ?? "custom",
        energyIdeal: input.energyIdeal ?? "medium",
        icon: input.icon ?? "folder",
        expectedFrequency: input.expectedFrequency ?? "daily",
        triggerContext: input.triggerContext ?? "",
        sortOrder: (maxOrder ?? -1) + 1,
    }).returning();

    return created ?? null;
}
export async function updateSystem(id: string, userId: string, update: UpdateSystemInput) {
    const [updated] = await db.update(systems).set(update).where(and(eq(systems.id, id), eq(systems.userId, userId))).returning();

    return updated ?? null;
}

export async function getSystembyId(id: string, userId: string) {
    const [system] = await db.select()
        .from(systems)
        .where(
            and(
                eq(systems.id, id),
                eq(systems.userId, userId),
            )
        );

    return system ?? null;
}

export async function deactivateSystem(id: string, userId: string) {
    const [system] = await db.select().from(systems).where(and(eq(systems.id, id), eq(systems.userId, userId)));

    if (!system) throw new NotFoundError('NOT_FOUND: System not found');
    if (system.isInbox) throw new ForbiddenError('FORBIDDEN: Cannot deactivate Inbox');

    const [updated] = await db
        .update(systems)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(systems.id, system.id), eq(systems.userId, userId)))
        .returning();

    return updated;
}

export async function reorderSystem(userId: string, ids: string[]) {
    await db.transaction(async (tx) => {
        for (let i = 0; i < ids.length; i++) {
            await tx.update(systems)
                .set({ sortOrder: i })
                .where(
                    and(
                        eq(systems.id, ids[i]),
                        eq(systems.userId, userId)
                    )
                )
        }
    });
}
