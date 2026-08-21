import { NextResponse } from "next/server";
import { createInboxForUser } from "@/features/systems/systems.service";
import { getServerSession } from "@/shared/utils/session";

// Session-only a propósito (KIN-144): bootstrap posterior al registro, corre
// una sola vez desde la UI. No migrar a getAuthContext.
export async function POST() {
    const session = await getServerSession();
    if (!session) {
        return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
    }

    await createInboxForUser(session.user.id);
    return NextResponse.json({ ok: true });
}
