import { Pool } from "pg";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function getVectorStore() {
  const tableName = process.env.PGVECTOR_TABLE || "lawbandit_embeddings";
  return await PGVectorStore.initialize(
    new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
    { pool, tableName }
  );
}
