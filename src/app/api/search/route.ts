import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { searchAll } from "@/features/search/search.service";
import { SEARCH_MIN_LENGTH } from "@/features/search/search.types";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < SEARCH_MIN_LENGTH) return NextResponse.json([]);

  const results = await searchAll(ctx.userId, q);
  return NextResponse.json(results);
}
