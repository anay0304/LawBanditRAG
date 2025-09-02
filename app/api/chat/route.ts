import { NextRequest, NextResponse } from "next/server";
import { askRag } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Source = { filename: string; page: number };
type Snippet = { filename: string; page: number; text: string };
type AskResponse = { answer: string; sources: Source[]; snippets: Snippet[] };

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/chat" });
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("message" in body) ||
      !("docId" in body)
    ) {
      return NextResponse.json(
        { error: "Missing message or docId" },
        { status: 400 }
      );
    }

    const { message, docId } = body as { message: string; docId: string };
    if (!message || !docId) {
      return NextResponse.json(
        { error: "Missing message or docId" },
        { status: 400 }
      );
    }

    const { answer, sources, snippets } = (await askRag(
      message,
      docId
    )) as AskResponse;
    return NextResponse.json({ answer, sources, snippets } satisfies AskResponse);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("CHAT_ERR:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
