import { NextRequest, NextResponse } from "next/server";
import * as os from "os";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getVectorStore } from "@/lib/db";
import { loadAndChunk } from "@/lib/loaders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    // Reuse docId if provided -> "collection mode"
    const url = new URL(req.url);
    const existingDocId = url.searchParams.get("docId");
    const docId = existingDocId ?? randomUUID();

    // Write uploaded file to OS temp dir (works on Windows/macOS/Linux/Vercel)
    const buf = Buffer.from(await file.arrayBuffer());
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${file.name}`);
    await fs.writeFile(tmpPath, buf);

    // Embed & store
    const store = await getVectorStore();
    const chunks = await loadAndChunk(tmpPath, file.name);
    for (const c of chunks) {
      c.metadata = { ...(c.metadata as any), docId, filename: file.name };
    }
    await store.addDocuments(chunks);

    try {
      await fs.unlink(tmpPath);
    } catch {}

    return NextResponse.json({ ok: true, docId, filename: file.name });
  } catch (e: any) {
    console.error("UPLOAD_ERR:", e);
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: 500 });
  }
}
