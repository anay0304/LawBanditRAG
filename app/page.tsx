"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function DropUpload({ onFile }: { onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type === "application/pdf") onFile(f);
      }}
      className={`rounded-2xl border-2 border-dashed p-8 text-center transition
        ${over ? "border-blue-500 bg-blue-500/5" : "border-zinc-700"}`}
    >
      <p className="mb-2 text-zinc-200">Drag & drop a PDF here</p>
      <p className="text-xs text-zinc-400">or</p>
      <label className="inline-block mt-3 cursor-pointer px-3 py-2 rounded bg-black text-white">
        Choose file
        <input
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function uploadFile(file: File, existingDocId?: string) {
    const fd = new FormData();
    fd.append("file", file);
    setLoading(true);
    try {
      const url = existingDocId ? `/api/upload?docId=${existingDocId}` : "/api/upload";
      const res = await fetch(url, { method: "POST", body: fd });
      const data: { ok?: boolean; docId?: string; filename?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      router.push(`/chat?docId=${data.docId}&file=${encodeURIComponent(data.filename || file.name)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  // 1-click demo using /public/sample.pdf
  async function demoUpload() {
    try {
      setLoading(true);
      const res = await fetch("/sample.pdf");
      const blob = await res.blob();
      const file = new File([blob], "sample.pdf", { type: "application/pdf" });
      await uploadFile(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6 space-y-5">
      <h1 className="text-2xl font-semibold">LawBandit • Chat with your PDF</h1>

      <DropUpload onFile={(file) => uploadFile(file)} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={demoUpload}
          disabled={loading}
          className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-900 disabled:opacity-50"
          title="Loads /public/sample.pdf and uploads it automatically"
        >
          Try sample PDF
        </button>
        <span className="text-xs text-zinc-500 self-center">
          {loading ? "Uploading…" : "Max ~20MB • PDF only"}
        </span>
      </div>
    </main>
  );
}
