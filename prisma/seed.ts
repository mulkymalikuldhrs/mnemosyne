import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Create Demo User ───
  const hashedPassword = await bcrypt.hash('demo123', 12)

  const user = await prisma.user.upsert({
    where: { email: 'demo@memorix.ai' },
    update: {},
    create: {
      email: 'demo@memorix.ai',
      name: 'Demo User',
      password: hashedPassword,
      plan: 'PRO',
    },
  })

  console.log(`✅ User created: ${user.email} (${user.id})`)

  // ─── Create Sample Notes ───
  const notesData = [
    {
      title: 'AI and the Future of Personal Knowledge Management',
      content:
        'The intersection of AI and personal knowledge management is transforming how we capture, organize, and retrieve information. With RAG (Retrieval-Augmented Generation) systems, we can now have AI assistants that truly understand our personal context and memory. The key insight is that embeddings allow semantic search over our own notes, creating a "second brain" that can surface relevant information exactly when needed. This is fundamentally different from traditional search — instead of keyword matching, we match meaning and intent.',
      markdown:
        '# AI and the Future of Personal Knowledge Management\n\nThe intersection of AI and personal knowledge management is transforming how we capture, organize, and retrieve information. With **RAG (Retrieval-Augmented Generation)** systems, we can now have AI assistants that truly understand our personal context and memory.\n\nThe key insight is that **embeddings allow semantic search** over our own notes, creating a "second brain" that can surface relevant information exactly when needed. This is fundamentally different from traditional search — instead of keyword matching, we match meaning and intent.',
      tags: 'ai,knowledge-management,rag,embeddings',
    },
    {
      title: 'Trading Strategy: Momentum with Risk Management',
      content:
        'Key principles for momentum-based trading: 1) Always define stop-loss before entering a trade. 2) Position sizing should never risk more than 2% of portfolio on a single trade. 3) Look for volume confirmation on breakouts. 4) Use trailing stops to protect gains. 5) Correlation analysis — don\'t take multiple trades that are highly correlated. The biggest mistake traders make is not having a written plan before entering. Decisions made in the heat of the moment are almost always emotional, not rational.',
      markdown:
        '# Trading Strategy: Momentum with Risk Management\n\nKey principles for momentum-based trading:\n\n1. **Always define stop-loss** before entering a trade\n2. **Position sizing** should never risk more than 2% of portfolio on a single trade\n3. Look for **volume confirmation** on breakouts\n4. Use **trailing stops** to protect gains\n5. **Correlation analysis** — don\'t take multiple trades that are highly correlated\n\n> The biggest mistake traders make is not having a written plan before entering. Decisions made in the heat of the moment are almost always emotional, not rational.',
      tags: 'trading,risk-management,strategy,momentum',
    },
    {
      title: 'Business Idea: AI-Powered Meeting Summaries',
      content:
        'Problem: People spend 30% of their workweek in meetings, and 70% of that information is forgotten within 24 hours. Existing solutions (Otter, Fireflies) just transcribe — they don\'t understand context. Solution: An AI that not only transcribes but connects meeting content to your personal knowledge base. It should: 1) Extract action items and decisions. 2) Link discussions to existing notes and projects. 3) Surface related past conversations. 4) Generate follow-up reminders. Market size: $5B+ productivity tools market. Differentiation: Context-aware, not just transcription. Personal memory integration.',
      markdown:
        '# Business Idea: AI-Powered Meeting Summaries\n\n**Problem:** People spend 30% of their workweek in meetings, and 70% of that information is forgotten within 24 hours. Existing solutions (Otter, Fireflies) just transcribe — they don\'t understand context.\n\n**Solution:** An AI that not only transcribes but **connects meeting content to your personal knowledge base**. It should:\n\n1. Extract action items and decisions\n2. Link discussions to existing notes and projects\n3. Surface related past conversations\n4. Generate follow-up reminders\n\n**Market size:** $5B+ productivity tools market\n**Differentiation:** Context-aware, not just transcription. Personal memory integration.',
      tags: 'business-idea,ai,startup,productivity,meetings',
    },
    {
      title: 'Decision Framework: Reversible vs Irreversible Choices',
      content:
        'Amazon\'s one-way vs two-way door framework is incredibly useful. Type 1 (irreversible) decisions: Should be made slowly, with deliberation, gathering data, and getting input. Examples: Quitting a job, moving cities, large investments. Type 2 (reversible) decisions: Should be made fast. If it doesn\'t work out, you can always go back. Examples: Trying a new tool, starting a side project, testing a marketing channel. Most decisions are Type 2. The trap is treating Type 2 decisions as Type 1 — this leads to analysis paralysis and missed opportunities.',
      markdown:
        '# Decision Framework: Reversible vs Irreversible Choices\n\nAmazon\'s **one-way vs two-way door** framework is incredibly useful.\n\n**Type 1 (irreversible) decisions:** Should be made slowly, with deliberation, gathering data, and getting input.\n- Examples: Quitting a job, moving cities, large investments\n\n**Type 2 (reversible) decisions:** Should be made fast. If it doesn\'t work out, you can always go back.\n- Examples: Trying a new tool, starting a side project, testing a marketing channel\n\n> Most decisions are Type 2. The trap is treating Type 2 decisions as Type 1 — this leads to analysis paralysis and missed opportunities.',
      tags: 'decision-making,framework,amazon,productivity',
    },
    {
      title: 'Vector Embeddings Explained Simply',
      content:
        'Think of embeddings as coordinates on a map. Similar things end up close together on the map, different things far apart. When we embed the sentence "I love machine learning" and "AI is amazing", they end up nearby because they mean similar things. But "I love machine learning" and "I love baking bread" are further apart even though the words are similar — because the meaning is different. The magic is that this "map" has hundreds of dimensions (not just 2D), allowing it to capture very nuanced relationships. Common models: OpenAI text-embedding-3-small, nomic-embed-text, Cohere embed-v3.',
      markdown:
        '# Vector Embeddings Explained Simply\n\nThink of embeddings as **coordinates on a map**. Similar things end up close together on the map, different things far apart.\n\nWhen we embed the sentence "I love machine learning" and "AI is amazing", they end up **nearby** because they mean similar things. But "I love machine learning" and "I love baking bread" are **further apart** even though the words are similar — because the meaning is different.\n\nThe magic is that this "map" has **hundreds of dimensions** (not just 2D), allowing it to capture very nuanced relationships.\n\n**Common models:**\n- OpenAI text-embedding-3-small\n- nomic-embed-text\n- Cohere embed-v3',
      tags: 'ai,embeddings,vectors,explainer,machine-learning',
    },
  ]

  const notes: Awaited<ReturnType<typeof prisma.note.create>>[] = []
  for (const noteData of notesData) {
    const note = await prisma.note.create({
      data: {
        userId: user.id,
        title: noteData.title,
        content: noteData.content,
        markdown: noteData.markdown,
        tags: noteData.tags,
      },
    })
    notes.push(note)
    console.log(`📝 Note created: ${note.title}`)
  }

  // ─── Create Conversation with Messages ───
  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: 'Exploring RAG Architecture',
    },
  })

  console.log(`💬 Conversation created: ${conversation.title}`)

  const messages = [
    {
      role: 'USER',
      content:
        'How does RAG work with personal memory? I want to understand how my notes get connected to AI responses.',
      memoryRefs: '[]',
    },
    {
      role: 'ASSISTANT',
      content:
        'RAG (Retrieval-Augmented Generation) works by first searching your personal memory (notes, decisions, past conversations) for information relevant to your question, then injecting that context into the AI prompt before generating a response.\n\nHere\'s the flow:\n1. **You ask a question** — e.g., "What was my trading strategy?"\n2. **Semantic search** — The system converts your question into an embedding vector and finds the most similar chunks in your notes\n3. **Context injection** — The top-k relevant notes are inserted into the system prompt\n4. **LLM generation** — The AI generates a response grounded in your actual notes, not generic knowledge\n\nThis is why [note:1] about AI and knowledge management matters — your notes become the AI\'s working memory. The key advantage over plain ChatGPT is that responses are personalized and cite your own notes.',
      memoryRefs: '["1"]',
    },
    {
      role: 'USER',
      content: 'What about the embedding model? Does it matter which one I use?',
      memoryRefs: '[]',
    },
    {
      role: 'ASSISTANT',
      content:
        'Yes, the embedding model matters a lot! As [note:5] explains, embeddings are like coordinates — similar concepts end up close together. The quality of that "map" determines how good your search results are.\n\nKey considerations:\n- **Dimensionality**: Higher dimensions (768, 1536) capture more nuance but use more storage\n- **Model choice**: nomic-embed-text is great for local/self-hosted. OpenAI\'s models are excellent but require API access\n- **Consistency**: Always use the same model for all embeddings — mixing models breaks the coordinate system\n\nFor personal knowledge management, nomic-embed-text at 768 dimensions is a solid starting point. It\'s fast, free to run locally, and performs well on semantic similarity tasks.',
      memoryRefs: '["5"]',
    },
  ]

  for (const msg of messages) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: msg.role,
        content: msg.content,
        memoryRefs: msg.memoryRefs,
      },
    })
  }

  console.log(`💬 Messages created: ${messages.length}`)

  // ─── Create Decisions ───
  const decisions = [
    {
      title: 'Choose nomic-embed-text over OpenAI embeddings',
      context:
        'Building the Memorix memory engine requires an embedding model for semantic search. Options: OpenAI text-embedding-3-small (proprietary, API-dependent) vs nomic-embed-text (open-source, self-hostable).',
      decision:
        'Use nomic-embed-text as the default embedding model with a fallback to pseudo-embeddings for development.',
      reasoning:
        'Self-hosting avoids API dependency and cost. Nomic-embed-text has comparable quality to OpenAI\'s small model. Pseudo-embeddings as fallback means the app works even without any embedding API, which is essential for the MVP. Users who want better quality can configure an external embedding API.',
      outcome: null,
      evaluation: null,
      relatedNoteIds: '[]',
    },
    {
      title: 'SQLite over PostgreSQL for MVP',
      context:
        'Need to choose a database for the initial launch. PostgreSQL supports pgvector for native vector search. SQLite is simpler but lacks vector extensions.',
      decision:
        'Use SQLite with JSON-stored embeddings and application-level similarity search for the MVP.',
      reasoning:
        'SQLite eliminates infrastructure complexity (no server to manage, zero config). The target is individual users with personal note collections — likely <10K notes per user. At this scale, in-memory cosine similarity is fast enough (<100ms). We can migrate to PostgreSQL + pgvector later when we need multi-user scale or real-time collaboration. The Prisma schema is designed to be database-agnostic.',
      outcome: null,
      evaluation: null,
      relatedNoteIds: '[]',
    },
  ]

  for (const decisionData of decisions) {
    const decision = await prisma.decision.create({
      data: {
        userId: user.id,
        title: decisionData.title,
        context: decisionData.context,
        decision: decisionData.decision,
        reasoning: decisionData.reasoning,
        outcome: decisionData.outcome,
        evaluation: decisionData.evaluation,
        relatedNoteIds: decisionData.relatedNoteIds,
      },
    })
    console.log(`🎯 Decision created: ${decision.title}`)
  }

  console.log('\n🎉 Seeding complete!')
  console.log(`   User: ${user.email}`)
  console.log(`   Notes: ${notes.length}`)
  console.log(`   Conversations: 1 (${messages.length} messages)`)
  console.log(`   Decisions: ${decisions.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
