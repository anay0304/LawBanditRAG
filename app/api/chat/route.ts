import { NextRequest, NextResponse } from "next/server";
import { askRag } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/chat" });
}

export async function POST(req: NextRequest) {
  try {
    const { message, docId } = await req.json();
    if (!message || !docId) {
      return NextResponse.json({ error: "Missing message or docId" }, { status: 400 });
    }
    const { answer, sources, snippets } = await askRag(message, docId);
    return NextResponse.json({ answer, sources, snippets });
  } catch (e: any) {
    console.error("CHAT_ERR:", e);
    return NextResponse.json({ error: e?.message ?? "Chat failed" }, { status: 400 });
  }
}
