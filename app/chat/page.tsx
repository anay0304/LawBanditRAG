import { Suspense } from "react";
import ChatClient from "./chatClient";

// These must live in a *server* file, not a "use client" file.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const dynamicParams = true;
// (Optional) extra belt-and-suspenders:
// export const fetchCache = "force-no-store";

export default function Page() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl p-6">Loading chat…</main>}>
      <ChatClient />
    </Suspense>
  );
}
