import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createInboxForUser } from "@/features/systems/systems.service";

export async function POST() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
    }

    await createInboxForUser(session.user.id);
    return NextResponse.json({ ok: true });
}
