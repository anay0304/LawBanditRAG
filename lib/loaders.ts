import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export async function loadAndChunk(filePath: string, filename: string) {
  const loader = new PDFLoader(filePath, { splitPages: true });
  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitDocuments(docs);
  return chunks.map((d) => ({
    ...d,
    metadata: {
      ...d.metadata,
      filename,
      pageNumber: d.metadata?.loc?.pageNumber ?? d.metadata?.pageNumber ?? null,
    },
  }));
}
