// lib/rag.ts
import { ChatOpenAI } from "@langchain/openai";
import { getVectorStore } from "@/lib/db";
import { PromptTemplate } from "@langchain/core/prompts";
import { ContextualCompressionRetriever } from "langchain/retrievers/contextual_compression";
import { LLMChainExtractor } from "langchain/retrievers/document_compressors/chain_extract";

type Source = { filename: string; page: number };
type Snippet = { filename: string; page: number; text: string };

const SYSTEM = `You are a helpful legal assistant.
Answer ONLY using the provided context. If the answer is not in the context, say "I don't know".
Be concise. Do NOT invent page numbers or facts.`;

const prompt = PromptTemplate.fromTemplate(
  `{system}

Question: {question}

Context:
{context}

Write a precise answer in 3–6 sentences.`
);

async function expandQuery(q: string) {
  const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
  const hyp = await llm.invoke(
    `Write a concise 2–3 sentence hypothetical answer (no fluff) to this question:\n"${q}".`
  );
  return String(hyp.content || "");
}

export async function askRag(question: string, docId: string) {
  const store = await getVectorStore();

  // 1) Contextual compression retriever (keeps only relevant spans)
  const baseRetriever = store.asRetriever({ k: 12, filter: { docId } as any });
  const compressor = LLMChainExtractor.fromLLM(
    new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 })
  );
  const ccRetriever = new ContextualCompressionRetriever({
    baseCompressor: compressor,
    baseRetriever,
  });

  // compressed docs for the original question
  const compressed = await ccRetriever.getRelevantDocuments(question);

  // 2) HyDE: expand the query and search with the hypothetical answer too
  const expanded = await expandQuery(question);
  const withScores = await store.similaritySearchWithScore(expanded, 8, {
    filter: { docId } as any,
  });

  // Filter weak matches from HyDE results
  const hydeStrong = withScores.filter(([, s]) => s > 0.2).map(([d]) => d);

  // 3) Merge + dedupe (prefer compressed docs, then HyDE strong matches)
  const keyed = new Map<string, any>();
  const keyOf = (d: any) =>
    `${d.metadata?.filename}|${d.metadata?.pageNumber}|${d.pageContent.slice(
      0,
      120
    )}`;
  for (const d of compressed) keyed.set(keyOf(d), d);
  for (const d of hydeStrong) if (!keyed.has(keyOf(d))) keyed.set(keyOf(d), d);

  const docs = Array.from(keyed.values()).slice(0, 8);

  // 4) Build context
  const context = docs
    .map(
      (d: any) =>
        `(${d.metadata?.filename} p.${d.metadata?.pageNumber ?? "?"}) ${d.pageContent}`
    )
    .join("\n\n");

  // 5) Sources (dedup + sort)
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const d of docs) {
    const filename = (d.metadata?.filename as string) ?? "document.pdf";
    const page = Number(d.metadata?.pageNumber ?? 0) || 0;
    const key = `${filename}|${page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ filename, page });
  }
  sources.sort(
    (a, b) => a.filename.localeCompare(b.filename) || a.page - b.page
  );

  // 6) Snippets for the Sources drawer
  const snippets: Snippet[] = docs.slice(0, 4).map((d: any) => ({
    filename: (d.metadata?.filename as string) ?? "document.pdf",
    page: Number(d.metadata?.pageNumber ?? 0) || 0,
    text:
      d.pageContent.slice(0, 500) +
      (d.pageContent.length > 500 ? "…" : ""),
  }));

  if (sources.length === 0) {
    return {
      answer: `I don't know. I couldn’t find evidence in the document.`,
      sources,
      snippets,
    };
  }

  // 7) Answer with the LLM
  const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
  const p = await prompt.format({ system: SYSTEM, question, context });
  const completion = await llm.invoke(p);

  return {
    answer:
      typeof completion.content === "string"
        ? completion.content
        : String(completion.content),
    sources,
    snippets,
  };
}
