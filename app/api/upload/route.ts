import { NextRequest, NextResponse } from "next/server";
import * as os from "os";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getVectorStore } from "@/lib/db";
import { loadAndChunk } from "@/lib/loaders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Doc = {
  pageContent: string;
  metadata: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Reuse docId if provided -> collection mode
    const url = new URL(req.url);
    const existingDocId = url.searchParams.get("docId");
    const docId = existingDocId ?? randomUUID();

    // Write to OS tmp
    const buf = Buffer.from(await file.arrayBuffer());
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${file.name}`);
    await fs.writeFile(tmpPath, buf);

    // Embed & store
    const store = await getVectorStore();
    const chunks = (await loadAndChunk(tmpPath, file.name)) as Doc[];

    for (const c of chunks) {
      const meta = (c.metadata ?? {}) as Record<string, unknown>;
      c.metadata = { ...meta, docId, filename: file.name } as Record<
        string,
        unknown
      >;
    }
    await store.addDocuments(chunks);

    try {
      await fs.unlink(tmpPath);
    } catch {
      // ignore ephemeral fs cleanup failures
    }

    return NextResponse.json({ ok: true, docId, filename: file.name });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("UPLOAD_ERR:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
