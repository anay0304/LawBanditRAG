# LawBandit • Smarter RAG (Chat with PDFs)

Upload PDFs → chunk & embed (pgvector/Neon) → retrieve (HyDE + contextual compression) → answer with page citations, sources drawer, and multi-PDF collections.

## Env
Copy `.env.local.example` → `.env.local` and fill:
- OPENAI_API_KEY
- DATABASE_URL (Neon)
- PGVECTOR_TABLE (e.g., `lawbandit_embeddings`)

## Dev
npm i
npm run dev

## Deploy
Vercel → Import repo → Project Settings → Environment Variables:
OPENAI_API_KEY, DATABASE_URL, PGVECTOR_TABLE
