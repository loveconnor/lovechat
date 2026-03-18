import cors from '@fastify/cors'
import bcrypt from 'bcryptjs'
import Fastify from 'fastify'
import type { FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import OpenAI from 'openai'
import { ZodError, z } from 'zod'
import { env } from './config/env.js'
import { checkPostgresConnection, initializeDatabase, pgPool } from './lib/postgres.js'
import { checkRedisConnection, redisClient } from './lib/redis.js'

const app = Fastify({ logger: true })
const openaiClient = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null

const webSearchSystemPrompt =
  'Web search is enabled for this request. Use the web_search tool for factual or source-dependent claims, verify key points against retrieved pages, and ground the response in those sources. Do not output a "Sources" section, do not list raw URLs, and do not include parenthetical domain citations in the answer body because citations are rendered separately in the UI.'

const visualizationSystemPrompt = `When the user asks for data trends, comparisons, forecasts, distributions, or relationships, render a chart packet instead of a markdown table.

Use this exact fenced format for each chart packet:
\`\`\`lovechat-chart
{JSON}
\`\`\`

The JSON must be a single object with this schema:
- version: 1
- component: "RenderChart"
- chartType: "line" | "bar" | "area" | "scatter"
- title: string
- description: optional string
- xAxis: { label: string, categories: string[] }
- yAxis: { label: string, format?: "number" | "currency" | "percent" }
- series: [{ name: string, data: number[], color?: string }]
- theme?: { palette?: string[] }
- actions?: [{ id: string, label: string, prompt: string }]

Rules:
- Keep JSON strictly valid and do not include trailing commas.
- Keep xAxis.categories length aligned with every series.data length.
- You may include normal explanation text before and after the chart packet.
- If an interactive follow-up is useful, add actions with short labels and a precise prompt the assistant can execute on click.`

const learningModeSystemPrompt = `# ROLE AND IDENTITY
You are Leo, operating in "Learning Mode" within the LoveChat app. You are an expert tutor, a patient mentor, and an insightful academic coach. Your primary goal is to facilitate deep, lasting understanding and critical thinking.
You are encouraging, highly observant, and adaptable. You believe that struggling with a problem is a core part of learning. Your tone is warm, supportive, and inquisitive.

# CORE PEDAGOGICAL DIRECTIVES
1. **NEVER Give the Direct Answer First:** This is your most important rule. If a user asks you to solve a math problem, write a script, or explain a concept, DO NOT just give them the solution. Instead, guide them to the solution themselves.
2. **Use the Socratic Method:** Ask targeted, thought-provoking questions. Lead the user to discover the answer by asking them what they already know, what they think the next step should be, or how a specific concept applies to their problem.
3. **Provide Scaffolding:** Break complex problems into smaller, manageable chunks. Focus on mastering one step at a time before moving to the next.
4. **Use Analogies:** Explain abstract or highly technical concepts using relatable, everyday analogies to anchor the user's understanding.
5. **Assess and Adapt:** Constantly gauge the user's skill level based on their responses. If they are advanced, ask harder questions. If they are struggling, simplify your language and break the steps down further.

# BEHAVIORAL RULES
- **Handling Mistakes:** If the user gives a wrong answer, do not simply say "That is incorrect." First, validate any part of their thought process that was correct. Then, gently point out the inconsistency or ask a question that helps them spot their own error (e.g., "I see why you did that! But what happens to X if we apply that logic?").
- **Handling Frustration:** If the user expresses extreme frustration or explicitly states they are completely stuck after multiple attempts, you may provide a "stepping stone"—a partial answer or a very strong hint—to unblock them, but leave the final connection for them to make.
- **Limiting Questions:** Never overwhelm the user. Ask a maximum of ONE or TWO guiding questions per response.

# FORMATTING AND STYLE
- Use **Markdown** to make your responses highly readable.
- Do not use parentheses in Markdown headings. Keep headings short, plain, and punctuation-light (for example: "Core Idea" instead of "Core idea (guided)").
- Use **bolding** to emphasize key vocabulary words or core concepts.
- When helping with code, DO NOT write the full code. Provide small snippets to illustrate a concept, or write pseudocode and ask the user to translate it into syntax.
- Use bullet points to lay out steps or summarize what has been learned so far.

# HANDLING CAPABILITIES & CONTEXT
- **File Uploads (Essays, Code, Worksheets):** If a user uploads a document for review, DO NOT rewrite it or correct all the errors for them. Instead, highlight a specific paragraph or line, explain the *type* of issue present (e.g., "There is a logical flaw in this loop," or "This thesis statement could be stronger"), and ask them how they might improve it.
- **Web Search:** If using Web Search to explain a topic, synthesize the information into an easy-to-understand lesson rather than just summarizing the search results.

# FINAL INSTRUCTION
Your success is not measured by how quickly you solve a problem, but by the "Aha!" moment you create for the user. End every response by handing the baton back to the user with a clear, engaging prompt or question for them to tackle next.`

await app.register(cors, {
  origin: env.WEB_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

const signUpSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
})

const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
})

const onboardingProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  nickname: z.string().trim().min(1).max(80),
  acknowledged: z.boolean().optional().default(false),
  completed: z.boolean().optional().default(false),
})

const accountProfileSchema = z.object({
  email: z.email().trim().toLowerCase(),
  fullName: z.string().trim().min(1).max(120),
  nickname: z.string().trim().min(1).max(80).optional(),
  baseStyleTone: z
    .enum(['default', 'professional', 'friendly', 'candid', 'quirky', 'efficient', 'nerdy', 'cynical'])
    .optional(),
  warmth: z.enum(['more', 'default', 'less']).optional(),
  enthusiasm: z.enum(['more', 'default', 'less']).optional(),
  headers: z.enum(['more', 'default', 'less']).optional(),
  emojis: z.enum(['more', 'default', 'less']).optional(),
  customInstructions: z.string().trim().max(8_000).optional(),
  occupation: z.string().trim().max(160).optional(),
  moreAboutYou: z.string().trim().max(2_000).optional(),
  avatarDataUrl: z
    .string()
    .trim()
    .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/)
    .max(7_000_000)
    .nullable()
    .optional(),
})

const dataControlsSchema = z.object({
  chatHistoryEnabled: z.boolean(),
})

const chatAttachmentSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(260),
  mimeType: z.string().trim().min(1).max(140),
  size: z.number().int().min(0).max(30_000_000),
  textContent: z.string().trim().min(1).max(20_000).optional(),
  imageDataUrl: z
    .string()
    .trim()
    .regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/)
    .max(6_000_000)
    .optional(),
})

const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().trim().min(1).max(8_000),
  attachments: z.array(chatAttachmentSchema).max(10).optional(),
  citations: z.unknown().optional(),
  searchedWeb: z.boolean().optional(),
})

const chatCompletionSchema = z.object({
  model: z.string().trim().min(1).max(80).optional(),
  useWebSearch: z.boolean().optional(),
  useLearningMode: z.boolean().optional(),
  chatSessionId: z.string().uuid().optional(),
  messages: z.array(chatMessageSchema).min(1).max(30),
})

const chatSessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
})

const chatGenerationIdParamSchema = z.object({
  generationId: z.string().uuid(),
})

const createChatSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
})

const renameChatSessionSchema = z.object({
  title: z.string().trim().min(1).max(120),
})

const forkChatSessionSchema = z.object({
  messageIndex: z.number().int().min(0).optional(),
  title: z.string().trim().min(1).max(120).optional(),
})

const memoryEntrySchema = z.object({
  content: z.string().trim().min(2).max(2_000),
  source: z.enum(['manual', 'auto']).optional().default('manual'),
  category: z.enum(['identity', 'preferences', 'goals', 'constraints']).optional(),
  scope: z.enum(['global', 'session']).optional(),
  chatSessionId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  summarize: z.boolean().optional().default(false),
  summarizeMode: z.enum(['default', 'assistant_response', 'user_request']).optional().default('default'),
})

const memoryFeedbackSchema = z.object({
  feedback: z.enum(['up', 'down']),
})

const memoryIdParamSchema = z.object({
  memoryId: z.string().uuid(),
})

const urlCitationAnnotationSchema = z.object({
  type: z.literal('url_citation'),
  url: z.string().url().optional(),
  title: z.string().optional(),
  url_citation: z
    .object({
      url: z.string().url().optional(),
      title: z.string().optional(),
    })
    .optional(),
})

const webSourceSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().optional(),
  favicon: z.string().optional(),
  favicon_url: z.string().optional(),
  icon: z.string().optional(),
  icon_url: z.string().optional(),
})

const responseOutputItemSchema = z.object({
  type: z.string(),
  action: z.string().optional(),
  queries: z.array(z.string()).optional(),
  sources: z.array(webSourceSchema).optional(),
  summary: z
    .array(
      z.object({
        type: z.string().optional(),
        text: z.string().optional(),
      }),
    )
    .optional(),
  content: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
        annotations: z.array(z.unknown()).optional(),
      }),
    )
    .optional(),
})

type RawSessionData = {
  userId: number | string
  email: string
}

type BaseStyleTone = 'default' | 'professional' | 'friendly' | 'candid' | 'quirky' | 'efficient' | 'nerdy' | 'cynical'
type CharacteristicLevel = 'more' | 'default' | 'less'

type PersonalizationProfile = {
  nickname: string
  occupation: string
  moreAboutYou: string
  baseStyleTone: BaseStyleTone
  warmth: CharacteristicLevel
  enthusiasm: CharacteristicLevel
  headers: CharacteristicLevel
  emojis: CharacteristicLevel
  customInstructions: string
}

type MemorySource = 'manual' | 'auto'
type MemoryCategory = 'identity' | 'preferences' | 'goals' | 'constraints'
type MemoryScope = 'global' | 'session'

type UserMemory = {
  id: string
  content: string
  source: MemorySource
  category: MemoryCategory
  scope: MemoryScope
  chatSessionId: string | null
  confidenceScore: number
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

type UserMemoryCandidate = UserMemory & {
  embedding: number[] | null
  embeddingModel: string | null
  importanceScore: number
  usageCount: number
  lastUsedAt: string | null
}

type MemoryUsageReason = 'identity' | 'style_preference' | 'goal_alignment' | 'constraint_guardrail'

type UsedMemoryContext = {
  id: string
  content: string
  category: MemoryCategory
  reason: MemoryUsageReason
  score: number
}

const MEMORY_RETRIEVAL_TOP_K = 8
const MEMORY_RETRIEVAL_CANDIDATE_LIMIT = 80
const MEMORY_DEFAULT_IMPORTANCE_SCORE = 0.5
const MEMORY_PROMPT_TOKEN_BUDGET = 800

const BASE_STYLE_PROMPTS: Record<BaseStyleTone, string> = {
  default: 'Maintain a helpful, clear, and balanced conversational tone.',
  professional:
    'Maintain a formal, objective, and highly professional tone. Use precise business language, avoid slang, and prioritize clarity.',
  friendly:
    'Be exceptionally warm, approachable, and conversational. Treat the user like a good friend, using casual and inviting language.',
  candid:
    'Be direct, brutally honest, and straightforward. Do not sugarcoat things or use unnecessary pleasantries. Get straight to the point.',
  quirky:
    'Be playful, unconventional, and a little eccentric. Use unique metaphors, clever wordplay, and a highly distinctive voice.',
  efficient:
    'Prioritize extreme brevity and utility. Strip out all conversational filler and pleasantries. Give only the exact information needed.',
  nerdy:
    'Embrace a highly technical, geeky tone. Use domain-specific jargon confidently, reference internet/tech culture where appropriate, and dive deep into the details.',
  cynical:
    'Adopt a dry, slightly sarcastic, and world-weary tone. Be helpful, but with a bit of a deadpan or cynical edge.',
}

const WARMTH_PROMPTS: Record<CharacteristicLevel, string> = {
  more: 'Infuse your responses with high empathy, compassion, and emotional warmth. Always validate the user.',
  default: 'Maintain a standard, polite level of warmth.',
  less: 'Keep your responses emotionally detached, clinical, and purely factual.',
}

const ENTHUSIASM_PROMPTS: Record<CharacteristicLevel, string> = {
  more: 'Show high energy and excitement in your responses. Use uplifting language and exclamation points where appropriate.',
  default: '',
  less: 'Maintain a calm, subdued, and muted energy level. Strictly avoid using exclamation points.',
}

const HEADERS_PROMPTS: Record<CharacteristicLevel, string> = {
  more:
    'Use abundant markdown formatting. Heavily utilize bolding, bullet points, and ### Headers to highly structure and visually break up every response.',
  default: 'Use markdown formatting (bolding, lists, headers) naturally when it helps readability.',
  less: 'Minimize the use of markdown. Prefer standard plain-text paragraphs over heavy formatting, lists, or headers.',
}

const EMOJI_PROMPTS: Record<CharacteristicLevel, string> = {
  more: 'Use emojis frequently and creatively to express emotion and illustrate your points.',
  default: 'Use emojis sparingly and only when highly appropriate for the context.',
  less: 'NEVER use emojis in your responses under any circumstances.',
}

function normalizeUserId(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function getSessionTokenFromRequest(request: FastifyRequest) {
  const authHeader = request.headers.authorization
  if (!authHeader) {
    return null
  }

  if (!authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    return null
  }

  return token
}

function resolveModel(requestedModel?: string) {
  if (!requestedModel) {
    return env.OPENAI_MODEL
  }

  const normalized = requestedModel.trim().toLowerCase()
  if (!normalized.startsWith('gpt-')) {
    return env.OPENAI_MODEL
  }

  return normalized
}

function sanitizePromptField(value: string | null | undefined, fallback = '') {
  return (value ?? '').trim() || fallback
}

function parseBaseStyleTone(value: string | null | undefined): BaseStyleTone {
  return value === 'professional' ||
    value === 'friendly' ||
    value === 'candid' ||
    value === 'quirky' ||
    value === 'efficient' ||
    value === 'nerdy' ||
    value === 'cynical'
    ? value
    : 'default'
}

function parseCharacteristicLevel(value: string | null | undefined): CharacteristicLevel {
  return value === 'more' || value === 'less' ? value : 'default'
}

async function loadPersonalizationProfile(userId: number): Promise<PersonalizationProfile> {
  const result = await pgPool.query<{
    nickname: string | null
    occupation: string | null
    more_about_you: string | null
    base_style_tone: string | null
    warmth_level: string | null
    enthusiasm_level: string | null
    headers_level: string | null
    emojis_level: string | null
    custom_instructions: string | null
  }>(
    `
    SELECT
      nickname,
      occupation,
      more_about_you,
      base_style_tone,
      warmth_level,
      enthusiasm_level,
      headers_level,
      emojis_level,
      custom_instructions
    FROM onboarding_profiles
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  )

  const row = result.rows[0]

  return {
    nickname: sanitizePromptField(row?.nickname, 'Friend'),
    occupation: sanitizePromptField(row?.occupation, 'Not provided'),
    moreAboutYou: sanitizePromptField(row?.more_about_you, 'Not provided'),
    baseStyleTone: parseBaseStyleTone(row?.base_style_tone),
    warmth: parseCharacteristicLevel(row?.warmth_level),
    enthusiasm: parseCharacteristicLevel(row?.enthusiasm_level),
    headers: parseCharacteristicLevel(row?.headers_level),
    emojis: parseCharacteristicLevel(row?.emojis_level),
    customInstructions: sanitizePromptField(row?.custom_instructions, 'No additional instructions provided.'),
  }
}

function buildPersonalizedSystemPrompt(profile: PersonalizationProfile) {
  const enthusiasmPrompt = ENTHUSIASM_PROMPTS[profile.enthusiasm]

  return [
    '# ROLE',
    'You are Leo, the official AI assistant for LoveChat.',
    '',
    '# USER PROFILE',
    `You are talking to: ${profile.nickname}`,
    `Occupation: ${profile.occupation}`,
    `Background: ${profile.moreAboutYou}`,
    '',
    '# PERSONALITY & TONE',
    BASE_STYLE_PROMPTS[profile.baseStyleTone],
    WARMTH_PROMPTS[profile.warmth],
    ...(enthusiasmPrompt ? [enthusiasmPrompt] : []),
    '',
    '# FORMATTING & RULES',
    HEADERS_PROMPTS[profile.headers],
    EMOJI_PROMPTS[profile.emojis],
    '',
    '# CUSTOM INSTRUCTIONS',
    'The user has provided the following strict instructions for how you must behave:',
    '"""',
    profile.customInstructions,
    '"""',
  ].join('\n')
}

function normalizeMemoryContent(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function plainTextForMemory(value: string) {
  return normalizeMemoryContent(
    value
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\((?:[^)]+)\)/g, ' ')
      .replace(/\[[^\]]+\]\((?:[^)]+)\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, ''),
  )
}

function fallbackSummarizeMemoryContent(value: string, maxLength = 240) {
  const plain = plainTextForMemory(value)
  if (!plain) {
    return ''
  }

  if (plain.length <= maxLength) {
    return plain
  }

  const slice = plain.slice(0, maxLength)
  const boundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '))
  if (boundary >= 48) {
    return slice.slice(0, boundary + 1).trim()
  }

  return slice.trim()
}

function cleanupMemorySummary(value: string) {
  let cleaned = normalizeMemoryContent(value)

  // Remove common assistant lead-ins so memory doesn't look like a chat reply.
  cleaned = cleaned
    .replace(/^(?:certainly|sure|of course|absolutely|definitely)\b[,:.!\s-]*/i, '')
    .replace(/^(?:here(?:'s| is)|below is|this is)\b[,:.!\s-]*/i, '')
    .replace(/^(?:you can|i can|i will|we can)\b[,:.!\s-]*/i, '')
    .trim()

  return cleaned
}

function toDurableMemory(value: string, maxLength = 240) {
  const cleaned = cleanupMemorySummary(value)
  if (!cleaned) {
    return ''
  }

  const dePrefixed = cleaned
    .replace(/^user\s+requested\s*:\s*/i, '')
    .replace(/^user\s+asked\s*:\s*/i, '')
    .replace(/^request\s*:\s*/i, '')
    .trim()

  if (!dePrefixed) {
    return ''
  }

  if (
    /^(?:interested in|prefers|working on|goal:\s*|needs\s+|uses\s+|studies\s+|is\s+a\s+|identifies as\s+)/i.test(
      dePrefixed,
    )
  ) {
    return dePrefixed.slice(0, maxLength).trim()
  }

  if (/^i\b/i.test(dePrefixed) || /^my\b/i.test(dePrefixed)) {
    return dePrefixed.slice(0, maxLength).trim()
  }

  const lowerFirst = `${dePrefixed.charAt(0).toLowerCase()}${dePrefixed.slice(1)}`
  const prefixed = `Interested in ${lowerFirst}`
  return prefixed.slice(0, maxLength).trim()
}

async function summarizeMemoryContent(value: string, mode: 'default' | 'assistant_response' | 'user_request' = 'default') {
  const maxLength = mode === 'default' ? 240 : 140
  const fallback = fallbackSummarizeMemoryContent(value, maxLength)
  if (!openaiClient) {
    return mode === 'default' ? cleanupMemorySummary(fallback) : toDurableMemory(fallback, maxLength)
  }

  try {
    const instruction =
      mode === 'assistant_response'
        ? 'Convert this assistant response into ONE concise durable memory about the user. Output plain text only as a stable preference/fact/goal. Prefer forms like "Interested in ...", "Prefers ...", "Working on ...", or "I ...". Never use "User requested". Do not include helper phrases like "Certainly". Hard limit: 140 characters.'
        : mode === 'user_request'
          ? 'Convert this user request into ONE concise durable memory. Capture the underlying recurring preference/interest/goal, not a full task sentence. Output plain text only. Prefer forms like "Interested in ...", "Prefers ...", "Working on ...", or "I ...". Never use "User requested". Hard limit: 140 characters.'
        : 'Summarize the user content into ONE concise long-term memory statement. Keep it factual and specific. Use plain text only. Do not include bullets, markdown, preambles, or quotes. Prefer first-person phrasing if the content is about the user. Hard limit: 240 characters.'

    const response = await openaiClient.responses.create({
      model: 'gpt-5-nano',
      max_output_tokens: 120,
      input: [
        {
          role: 'system',
          content: instruction,
        },
        {
          role: 'user',
          content: plainTextForMemory(value),
        },
      ],
    })

    const responseRecord = response as {
      output?: unknown
      output_text?: string
    }

    const extracted = extractTextAndCitations(responseRecord.output, responseRecord)
    const raw = extracted.text || (typeof responseRecord.output_text === 'string' ? responseRecord.output_text : '')
    const summarized = fallbackSummarizeMemoryContent(raw, maxLength)

    if (mode !== 'default') {
      const durable = toDurableMemory(summarized || fallback, maxLength)
      return durable || toDurableMemory(fallback, maxLength)
    }

    const cleaned = cleanupMemorySummary(summarized || fallback)
    return cleaned || cleanupMemorySummary(fallback)
  } catch (error) {
    app.log.warn({ error }, 'memory summarization failed; using fallback summarization')

    if (mode !== 'default') {
      return toDurableMemory(fallback, maxLength)
    }

    return cleanupMemorySummary(fallback)
  }
}

function normalizeMemoryContentForLookup(value: string) {
  return normalizeMemoryContent(value).toLowerCase()
}

function splitMemoryCandidateSentences(input: string) {
  return input
    .split(/[\n.!?]+/)
    .map((part) => normalizeMemoryContent(part))
    .filter(Boolean)
}

function isLikelyMemoryCandidate(sentence: string) {
  if (sentence.length < 8 || sentence.length > 220) {
    return false
  }

  if (sentence.endsWith('?')) {
    return false
  }

  const normalized = sentence.toLowerCase()

  return /^(?:remember\s+(?:that\s+)?)?(?:i am|i'm|i was|i work|i study|i live|my name is|my pronouns are|i prefer|i like|i dislike|i hate|i use|my goal is|i want|i need)\b/.test(
    normalized,
  )
}

function extractAutoMemoryCandidates(content: string) {
  const candidates = splitMemoryCandidateSentences(content)
    .map((sentence) =>
      sentence.replace(/^remember\s+(?:that\s+)?/i, '').replace(/^please\s+/, '').trim(),
    )
    .filter((sentence) => isLikelyMemoryCandidate(sentence))

  const deduped = new Map<string, string>()
  for (const candidate of candidates) {
    const key = normalizeMemoryContentForLookup(candidate)
    if (!deduped.has(key)) {
      deduped.set(key, candidate)
    }
  }

  return Array.from(deduped.values()).slice(0, 4)
}

function parseJsonArrayFromText(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    // Try to recover when model wraps the array in prose or code fences.
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenceMatch?.[1]) {
      try {
        const parsed = JSON.parse(fenceMatch[1].trim())
        return Array.isArray(parsed) ? parsed : null
      } catch {
        // Fall through.
      }
    }

    const firstBracket = trimmed.indexOf('[')
    const lastBracket = trimmed.lastIndexOf(']')
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      const slice = trimmed.slice(firstBracket, lastBracket + 1)
      try {
        const parsed = JSON.parse(slice)
        return Array.isArray(parsed) ? parsed : null
      } catch {
        return null
      }
    }

    return null
  }
}

async function inferAutoMemoryCandidates(content: string) {
  const normalized = plainTextForMemory(content)
  if (!normalized || normalized.length < 12) {
    return [] as string[]
  }

  const heuristicCandidates = extractAutoMemoryCandidates(normalized)

  if (!openaiClient) {
    return heuristicCandidates
  }

  let aiCandidates: string[] = []

  try {
    const response = await openaiClient.responses.create({
      model: 'gpt-5-nano',
      max_output_tokens: 220,
      input: [
        {
          role: 'system',
          content:
            'You extract long-term user memories from ONE user message. Return ONLY a JSON array of strings with 0 to 3 items. Include only durable personal preferences, identity facts, ongoing goals, or recurring constraints. Exclude one-off tasks, temporary requests, and answer content. Keep each item concise (<=120 chars).',
        },
        {
          role: 'user',
          content: normalized,
        },
      ],
    })

    const responseRecord = response as {
      output?: unknown
      output_text?: string
    }
    const extracted = extractTextAndCitations(responseRecord.output, responseRecord)
    const raw = extracted.text || (typeof responseRecord.output_text === 'string' ? responseRecord.output_text : '')

    const parsed = parseJsonArrayFromText(raw)
    if (parsed) {
      aiCandidates = parsed
        .map((item) => (typeof item === 'string' ? normalizeMemoryContent(item) : ''))
        .filter((item) => item.length >= 8 && item.length <= 160)
    }
  } catch (error) {
    app.log.warn({ error }, 'auto memory inference failed; falling back to heuristics')
  }

  const combined = [...aiCandidates, ...heuristicCandidates]
  const deduped = new Map<string, string>()
  for (const candidate of combined) {
    const cleaned = normalizeMemoryContent(candidate)
    if (!cleaned) {
      continue
    }

    const key = normalizeMemoryContentForLookup(cleaned)
    if (!deduped.has(key)) {
      deduped.set(key, cleaned)
    }
  }

  return Array.from(deduped.values()).slice(0, 3)
}

function estimateTokenCount(value: string) {
  const normalized = normalizeMemoryContent(value)
  if (!normalized) {
    return 0
  }

  // Fast heuristic: ~4 characters per token for mixed English/code text.
  return Math.max(1, Math.ceil(normalized.length / 4))
}

function packMemoryLinesWithinBudget(lines: string[], maxTokens: number) {
  const packed: string[] = []
  let usedTokens = 0

  for (const line of lines) {
    const lineTokens = estimateTokenCount(line)
    if (usedTokens + lineTokens > maxTokens) {
      break
    }

    packed.push(line)
    usedTokens += lineTokens
  }

  return {
    lines: packed,
    usedTokens,
  }
}

function buildMemoryPrompt(
  memories: UserMemory[],
  maxTokens = MEMORY_PROMPT_TOKEN_BUDGET,
): { prompt: string; usedMemories: UsedMemoryContext[] } {
  if (memories.length === 0) {
    return {
      prompt: '',
      usedMemories: [],
    }
  }

  const identityMemories = memories.filter((memory) => memory.category === 'identity')
  const preferenceMemories = memories.filter((memory) => memory.category === 'preferences')
  const goalMemories = memories.filter((memory) => memory.category === 'goals')
  const constraintMemories = memories.filter((memory) => memory.category === 'constraints')

  const staticHeaderLines = ['# LONG-TERM USER MEMORY']
  const staticHeaderTokens = estimateTokenCount(staticHeaderLines.join('\n'))
  const effectiveBudget = Math.max(120, maxTokens)

  if (staticHeaderTokens >= effectiveBudget) {
    return {
      prompt: staticHeaderLines[0],
      usedMemories: [],
    }
  }

  const orderedSectionConfigs: Array<{ title: string; instruction: string; memories: UserMemory[] }> = [
    {
      title: '## IDENTITY',
      instruction: 'Always keep these identity facts in mind unless the user explicitly corrects them:',
      memories: identityMemories,
    },
    {
      title: '## PREFERENCES',
      instruction: 'Use these to shape tone, formatting, and response style:',
      memories: preferenceMemories,
    },
    {
      title: '## GOALS',
      instruction: 'Bias suggestions, examples, and next steps toward these goals when relevant:',
      memories: goalMemories,
    },
    {
      title: '## CONSTRAINTS',
      instruction: 'Respect these constraints, tools, or boundaries in proposed solutions:',
      memories: constraintMemories,
    },
  ]

  const sections: string[] = [...staticHeaderLines]
  const usedMemories: UsedMemoryContext[] = []
  let remainingTokens = effectiveBudget - staticHeaderTokens

  for (const section of orderedSectionConfigs) {
    if (section.memories.length === 0 || remainingTokens <= 0) {
      continue
    }

    const memoryLines = section.memories.map((memory, index) => `${index + 1}. ${memory.content}`)
    const packed = packMemoryLinesWithinBudget(memoryLines, remainingTokens)

    if (packed.lines.length === 0) {
      continue
    }

    const sectionMetaTokens = estimateTokenCount(`${section.title}\n${section.instruction}`)
    if (sectionMetaTokens + packed.usedTokens > remainingTokens) {
      continue
    }

    sections.push(section.title, section.instruction, ...packed.lines, '')
    const packedCount = packed.lines.length
    for (let index = 0; index < packedCount; index += 1) {
      const memory = section.memories[index]
      if (!memory) {
        continue
      }

      usedMemories.push({
        id: memory.id,
        content: memory.content,
        category: memory.category,
        reason: memoryUsageReason(memory.category),
        score: 0,
      })
    }
    remainingTokens -= sectionMetaTokens + packed.usedTokens
  }

  return {
    prompt: sections.join('\n').trim(),
    usedMemories,
  }
}

function inferMemoryCategory(content: string): MemoryCategory {
  const normalized = plainTextForMemory(content).toLowerCase()

  if (
    /\b(goal|working on|building|launch(?:ing)?|trying to|plan to|planning to|want to|need to|roadmap|milestone)\b/.test(
      normalized,
    )
  ) {
    return 'goals'
  }

  if (
    /\b(prefer|prefers|i like|i dislike|i hate|short answers?|concise|detailed|tone|style|format|bullet points?|emoji|emojis)\b/.test(
      normalized,
    )
  ) {
    return 'preferences'
  }

  if (
    /\b(i am|i'm|my name is|i was|i study|i work as|i live|my pronouns|i identify as|background)\b/.test(
      normalized,
    )
  ) {
    return 'identity'
  }

  if (
    /\b(i use|using|must|cannot|can't|constraint|limited to|next\.?js|typescript|react|node\.?js|postgres|redis|docker|budget|deadline)\b/.test(
      normalized,
    )
  ) {
    return 'constraints'
  }

  return 'constraints'
}

function inferMemoryScope(
  content: string,
  category: MemoryCategory,
  chatSessionId?: string,
  requestedScope?: MemoryScope,
): MemoryScope {
  if (requestedScope) {
    return requestedScope
  }

  if (!chatSessionId) {
    return 'global'
  }

  const normalized = plainTextForMemory(content).toLowerCase()
  const looksTemporary =
    /\b(today|tonight|this week|this month|for now|currently|temporary|until|deadline|exam|interview)\b/.test(
      normalized,
    )

  if (looksTemporary || category === 'goals') {
    return 'session'
  }

  return 'global'
}

function inferMemoryExpiry(content: string, category: MemoryCategory): string | null {
  const normalized = plainTextForMemory(content).toLowerCase()
  const now = new Date()

  if (category === 'identity' || category === 'preferences') {
    return null
  }

  const ttlDays =
    category === 'goals'
      ? 45
      : /\b(for now|currently|temporary|until)\b/.test(normalized)
        ? 30
        : 180

  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)
  return expires.toISOString()
}

function tokenizeForSimilarity(value: string) {
  return new Set(tokenizeForMemoryRetrieval(value))
}

function jaccardSimilarity(left: string, right: string) {
  const leftTokens = tokenizeForSimilarity(left)
  const rightTokens = tokenizeForSimilarity(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  let intersection = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1
    }
  }

  const union = new Set([...leftTokens, ...rightTokens]).size
  return union === 0 ? 0 : intersection / union
}

function detectPreferenceAxis(content: string): 'length' | 'tone' | null {
  const normalized = plainTextForMemory(content).toLowerCase()
  if (/\b(short|concise|brief|detailed|detail|long|thorough)\b/.test(normalized)) {
    return 'length'
  }

  if (/\b(tone|formal|casual|professional|friendly|emoji|markdown)\b/.test(normalized)) {
    return 'tone'
  }

  return null
}

function detectPreferencePolarity(content: string): 'short' | 'detailed' | 'neutral' {
  const normalized = plainTextForMemory(content).toLowerCase()
  if (/\b(short|concise|brief)\b/.test(normalized)) {
    return 'short'
  }

  if (/\b(detailed|detail|long|thorough|explain everything)\b/.test(normalized)) {
    return 'detailed'
  }

  return 'neutral'
}

function memoryUsageReason(category: MemoryCategory): MemoryUsageReason {
  if (category === 'identity') {
    return 'identity'
  }

  if (category === 'preferences') {
    return 'style_preference'
  }

  if (category === 'goals') {
    return 'goal_alignment'
  }

  return 'constraint_guardrail'
}

function parseStoredEmbedding(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const embedding: number[] = []
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      return null
    }

    embedding.push(item)
  }

  return embedding
}

function normalizeImportanceScore(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return MEMORY_DEFAULT_IMPORTANCE_SCORE
  }

  return Math.min(1, Math.max(0, value))
}

function normalizeUsageCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.floor(value))
}

function parseDateMs(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function calculateImportanceComponent(memory: UserMemoryCandidate, nowMs: number) {
  const baseImportance = normalizeImportanceScore(memory.importanceScore)
  const frequencyScore = Math.min(1, Math.log1p(normalizeUsageCount(memory.usageCount)) / Math.log(10))
  const confidenceScore = Math.min(1, Math.max(0, memory.confidenceScore))

  const updatedMs = parseDateMs(memory.updatedAt) ?? nowMs
  const ageDays = Math.max(0, (nowMs - updatedMs) / (1000 * 60 * 60 * 24))
  const categoryHalfLifeDays: Record<MemoryCategory, number> = {
    identity: 3650,
    preferences: 365,
    goals: 30,
    constraints: 120,
  }
  const temporalDecay = Math.exp(-ageDays / categoryHalfLifeDays[memory.category])

  return (baseImportance * 0.55 + frequencyScore * 0.25 + confidenceScore * 0.2) * temporalDecay
}

function calculateRecencyComponent(memory: UserMemoryCandidate, nowMs: number) {
  const lastUsedMs = parseDateMs(memory.lastUsedAt)
  if (lastUsedMs === null) {
    return 0
  }

  const elapsedMs = Math.max(0, nowMs - lastUsedMs)
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24)
  // Exponential decay with ~30-day half-life style behavior.
  return Math.exp(-elapsedDays / 30)
}

function calculateMemoryRankingScore(memory: UserMemoryCandidate, relevance: number, nowMs: number) {
  const normalizedRelevance = Math.min(1, Math.max(0, relevance))
  const importance = calculateImportanceComponent(memory, nowMs)
  const recency = calculateRecencyComponent(memory, nowMs)

  return {
    score: normalizedRelevance + importance + recency,
    relevance: normalizedRelevance,
  }
}

async function loadUserMemoryCandidates(
  userId: number,
  chatSessionId?: string,
  limit = MEMORY_RETRIEVAL_CANDIDATE_LIMIT,
): Promise<UserMemoryCandidate[]> {
  const result = await pgPool.query<{
    id: string
    content: string
    source: MemorySource
    memory_type: MemoryCategory
    scope_type: MemoryScope
    session_id: string | null
    confidence_score: number | null
    expires_at: string | null
    created_at: string
    updated_at: string
    last_used_at: string | null
    embedding_json: unknown
    embedding_model: string | null
    importance_score: number | null
    usage_count: number | null
  }>(
    `
    SELECT id, content, source, memory_type, scope_type, session_id, confidence_score, expires_at, created_at, updated_at, last_used_at, embedding_json, embedding_model, importance_score, usage_count
    FROM user_memories
    WHERE user_id = $1
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (scope_type = 'global' OR (scope_type = 'session' AND session_id = $2))
    ORDER BY updated_at DESC
    LIMIT $3
    `,
    [userId, chatSessionId ?? null, limit],
  )

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    source: row.source,
    category: row.memory_type,
    scope: row.scope_type,
    chatSessionId: row.session_id,
    confidenceScore: Math.min(1, Math.max(0, row.confidence_score ?? 0.6)),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    embedding: parseStoredEmbedding(row.embedding_json),
    embeddingModel: row.embedding_model,
    importanceScore: normalizeImportanceScore(row.importance_score),
    usageCount: normalizeUsageCount(row.usage_count),
  }))
}

async function loadUserMemories(userId: number, limit = 40): Promise<UserMemory[]> {
  const result = await pgPool.query<{
    id: string
    content: string
    source: MemorySource
    memory_type: MemoryCategory
    scope_type: MemoryScope
    session_id: string | null
    confidence_score: number | null
    expires_at: string | null
    created_at: string
    updated_at: string
  }>(
    `
    SELECT id, content, source, memory_type, scope_type, session_id, confidence_score, expires_at, created_at, updated_at
    FROM user_memories
    WHERE user_id = $1
    ORDER BY updated_at DESC
    LIMIT $2
    `,
    [userId, limit],
  )

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content,
    source: row.source,
    category: row.memory_type,
    scope: row.scope_type,
    chatSessionId: row.session_id,
    confidenceScore: Math.min(1, Math.max(0, row.confidence_score ?? 0.6)),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

async function storeMemoryEmbedding(memoryId: string, embedding: number[]) {
  await pgPool.query(
    `
    UPDATE user_memories
    SET embedding_model = $2, embedding_json = $3::jsonb, embedding_updated_at = NOW()
    WHERE id = $1
    `,
    [memoryId, env.OPENAI_EMBEDDING_MODEL, JSON.stringify(embedding)],
  )
}

async function touchUserMemories(memoryIds: string[]) {
  if (memoryIds.length === 0) {
    return
  }

  await pgPool.query(
    `
    UPDATE user_memories
    SET last_used_at = NOW(), usage_count = COALESCE(usage_count, 0) + 1
    WHERE id = ANY($1::uuid[])
    `,
    [memoryIds],
  )
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return -1
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let index = 0; index < a.length; index += 1) {
    const aValue = a[index]
    const bValue = b[index]
    dot += aValue * bValue
    normA += aValue * aValue
    normB += bValue * bValue
  }

  if (normA === 0 || normB === 0) {
    return -1
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function tokenizeForMemoryRetrieval(value: string) {
  return plainTextForMemory(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
}

function selectMemoriesLexically(memories: UserMemoryCandidate[], userMessage: string, topK: number) {
  const queryTokens = new Set(tokenizeForMemoryRetrieval(userMessage))
  const nowMs = Date.now()
  const hasQueryTerms = queryTokens.size > 0

  const scored = memories.map((memory) => {
    if (!hasQueryTerms) {
      const ranking = calculateMemoryRankingScore(memory, 0, nowMs)
      return { memory, score: ranking.score, relevance: ranking.relevance }
    }

    const memoryTokens = tokenizeForMemoryRetrieval(memory.content)
    if (memoryTokens.length === 0) {
      const ranking = calculateMemoryRankingScore(memory, 0, nowMs)
      return { memory, score: ranking.score, relevance: ranking.relevance }
    }

    const overlapCount = memoryTokens.reduce(
      (count, token) => (queryTokens.has(token) ? count + 1 : count),
      0,
    )

    const relevance = overlapCount / Math.sqrt(queryTokens.size * memoryTokens.length)
    const ranking = calculateMemoryRankingScore(memory, relevance, nowMs)
    return { memory, score: ranking.score, relevance: ranking.relevance }
  })

  const positiveMatches = scored
    .filter((item) => (hasQueryTerms ? item.relevance > 0 : item.score > 0))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }

      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance
      }

      return Date.parse(b.memory.updatedAt) - Date.parse(a.memory.updatedAt)
    })

  if (positiveMatches.length === 0) {
    return memories.slice(0, Math.min(topK, 3))
  }

  return positiveMatches.slice(0, topK).map((item) => item.memory)
}

async function embedTextBatch(texts: string[]) {
  if (!openaiClient || texts.length === 0) {
    return null
  }

  try {
    const response = await openaiClient.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: texts,
    })

    const data = (response as { data?: Array<{ embedding?: unknown }> }).data
    if (!Array.isArray(data) || data.length !== texts.length) {
      return null
    }

    const vectors: number[][] = []
    for (const item of data) {
      const embedding = parseStoredEmbedding(item.embedding)
      if (!embedding) {
        return null
      }

      vectors.push(embedding)
    }

    return vectors
  } catch (error) {
    app.log.warn({ error }, 'memory embedding request failed')
    return null
  }
}

async function selectRelevantMemories(userMessage: string, memories: UserMemoryCandidate[], topK: number) {
  if (memories.length === 0) {
    return [] as UserMemory[]
  }

  const limitedTopK = Math.max(1, Math.min(topK, memories.length))
  const normalizedUserMessage = plainTextForMemory(userMessage)
  if (!normalizedUserMessage) {
    return memories.slice(0, limitedTopK)
  }

  if (!openaiClient) {
    return selectMemoriesLexically(memories, normalizedUserMessage, limitedTopK)
  }

  const queryVectors = await embedTextBatch([normalizedUserMessage])
  const queryVector = queryVectors?.[0]
  if (!queryVector) {
    return selectMemoriesLexically(memories, normalizedUserMessage, limitedTopK)
  }

  const staleMemories = memories.filter(
    (memory) => !memory.embedding || memory.embeddingModel !== env.OPENAI_EMBEDDING_MODEL,
  )

  if (staleMemories.length > 0) {
    const staleVectors = await embedTextBatch(staleMemories.map((memory) => memory.content))
    if (staleVectors) {
      await Promise.all(
        staleMemories.map(async (memory, index) => {
          const vector = staleVectors[index]
          if (!vector) {
            return
          }

          memory.embedding = vector
          memory.embeddingModel = env.OPENAI_EMBEDDING_MODEL
          await storeMemoryEmbedding(memory.id, vector)
        }),
      )
    }
  }

  const nowMs = Date.now()
  const scored = memories
    .map((memory) => {
      const similarity = memory.embedding ? cosineSimilarity(queryVector, memory.embedding) : -1
      if (similarity < 0) {
        return null
      }

      const ranking = calculateMemoryRankingScore(memory, similarity, nowMs)
      return {
        memory,
        score: ranking.score,
        relevance: ranking.relevance,
      }
    })
    .filter((item): item is { memory: UserMemoryCandidate; score: number; relevance: number } => item !== null)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }

      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance
      }

      return Date.parse(b.memory.updatedAt) - Date.parse(a.memory.updatedAt)
    })

  if (scored.length === 0) {
    return selectMemoriesLexically(memories, normalizedUserMessage, limitedTopK)
  }

  return scored.slice(0, limitedTopK).map((item) => item.memory)
}

async function upsertUserMemory(
  userId: number,
  content: string,
  source: MemorySource,
  category?: MemoryCategory,
  scope?: MemoryScope,
  chatSessionId?: string,
  expiresAt?: string,
) {
  const normalizedContent = normalizeMemoryContent(content)
  const normalizedLookup = normalizeMemoryContentForLookup(normalizedContent)
  const inferredCategory = category ?? inferMemoryCategory(normalizedContent)
  const requestedScope = inferMemoryScope(normalizedContent, inferredCategory, chatSessionId, scope)
  const inferredScope: MemoryScope = requestedScope === 'session' && !chatSessionId ? 'global' : requestedScope
  const effectiveSessionId = inferredScope === 'session' ? chatSessionId ?? null : null
  const effectiveExpiry = expiresAt ?? inferMemoryExpiry(normalizedContent, inferredCategory)

  const existingByCategoryResult = await pgPool.query<{
    id: string
    content: string
    memory_type: MemoryCategory
  }>(
    `
    SELECT id, content, memory_type
    FROM user_memories
    WHERE user_id = $1
      AND memory_type = $2
      AND scope_type = $3
      AND ((session_id IS NULL AND $4::uuid IS NULL) OR session_id = $4::uuid)
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY updated_at DESC
    LIMIT 8
    `,
    [userId, inferredCategory, inferredScope, effectiveSessionId],
  )

  const newPreferenceAxis = inferredCategory === 'preferences' ? detectPreferenceAxis(normalizedContent) : null
  const newPreferencePolarity =
    inferredCategory === 'preferences' ? detectPreferencePolarity(normalizedContent) : 'neutral'

  const conflictCandidate = existingByCategoryResult.rows.find((row) => {
    const similarity = jaccardSimilarity(normalizedContent, row.content)
    if (similarity >= 0.72) {
      return true
    }

    if (inferredCategory !== 'preferences') {
      return false
    }

    const existingAxis = detectPreferenceAxis(row.content)
    const existingPolarity = detectPreferencePolarity(row.content)
    return (
      newPreferenceAxis !== null &&
      existingAxis === newPreferenceAxis &&
      existingPolarity !== 'neutral' &&
      newPreferencePolarity !== 'neutral' &&
      existingPolarity !== newPreferencePolarity
    )
  })

  if (conflictCandidate) {
    const updatedConflict = await pgPool.query<{
      id: string
      content: string
      source: MemorySource
      memory_type: MemoryCategory
      scope_type: MemoryScope
      session_id: string | null
      confidence_score: number
      expires_at: string | null
      created_at: string
      updated_at: string
    }>(
      `
      UPDATE user_memories
      SET
        content = $3,
        content_normalized = $4,
        source = CASE
          WHEN user_memories.source = 'manual' THEN 'manual'
          ELSE $5
        END,
        memory_type = $6,
        scope_type = $7,
        session_id = $8,
        expires_at = $9,
        confidence_score = LEAST(1, GREATEST(COALESCE(user_memories.confidence_score, 0.6), CASE WHEN $5 = 'manual' THEN 0.85 ELSE 0.7 END)),
        embedding_model = NULL,
        embedding_json = NULL,
        embedding_updated_at = NULL,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, content, source, memory_type, scope_type, session_id, confidence_score, expires_at, created_at, updated_at
      `,
      [
        conflictCandidate.id,
        userId,
        normalizedContent,
        normalizedLookup,
        source,
        inferredCategory,
        inferredScope,
        effectiveSessionId,
        effectiveExpiry,
      ],
    )

    const row = updatedConflict.rows[0]
    return {
      id: row.id,
      content: row.content,
      source: row.source,
      category: row.memory_type,
      scope: row.scope_type,
      chatSessionId: row.session_id,
      confidenceScore: row.confidence_score,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  const result = await pgPool.query<{
    id: string
    content: string
    source: MemorySource
    memory_type: MemoryCategory
    scope_type: MemoryScope
    session_id: string | null
    confidence_score: number
    expires_at: string | null
    created_at: string
    updated_at: string
  }>(
    `
    INSERT INTO user_memories (id, user_id, content, content_normalized, source, memory_type, scope_type, session_id, confidence_score, expires_at, importance_score, usage_count)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)
    ON CONFLICT (user_id, content_normalized)
    DO UPDATE SET
      content = EXCLUDED.content,
      source = CASE
        WHEN user_memories.source = 'manual' THEN 'manual'
        ELSE EXCLUDED.source
      END,
      memory_type = EXCLUDED.memory_type,
      scope_type = EXCLUDED.scope_type,
      session_id = EXCLUDED.session_id,
      confidence_score = GREATEST(user_memories.confidence_score, EXCLUDED.confidence_score),
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING id, content, source, memory_type, scope_type, session_id, confidence_score, expires_at, created_at, updated_at
    `,
    [
      randomUUID(),
      userId,
      normalizedContent,
      normalizedLookup,
      source,
      inferredCategory,
      inferredScope,
      effectiveSessionId,
      source === 'manual' ? 0.85 : 0.6,
      effectiveExpiry,
      source === 'manual' ? 0.75 : MEMORY_DEFAULT_IMPORTANCE_SCORE,
    ],
  )

  const row = result.rows[0]
  return {
    id: row.id,
    content: row.content,
    source: row.source,
    category: row.memory_type,
    scope: row.scope_type,
    chatSessionId: row.session_id,
    confidenceScore: row.confidence_score,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mergeAndDedupeMemories(identityMemories: UserMemory[], rankedMemories: UserMemory[]) {
  const merged = new Map<string, UserMemory>()

  for (const memory of identityMemories) {
    merged.set(memory.id, memory)
  }

  for (const memory of rankedMemories) {
    if (!merged.has(memory.id)) {
      merged.set(memory.id, memory)
    }
  }

  return Array.from(merged.values())
}

async function upsertUserMemories(
  userId: number,
  candidates: string[],
  source: MemorySource,
  chatSessionId?: string,
) {
  for (const candidate of candidates) {
    const normalized = normalizeMemoryContent(candidate)
    if (!normalized) {
      continue
    }

    await upsertUserMemory(userId, normalized, source, undefined, undefined, chatSessionId)
  }
}

function shouldUseWebSearch(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  if (!lastUserMessage) {
    return false
  }

  return /\b(research|search)\b/i.test(lastUserMessage.content)
}

function shouldUseImageGeneration(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  if (!lastUserMessage) {
    return false
  }

  const content = lastUserMessage.content.toLowerCase()
  return /(make|generate|create|draw|design)\s+(?:me\s+)?(?:(?:an?|some)\s+)?(?:image|images|picture|pictures|photo|photos|illustration|illustrations|artwork|artworks)\b/.test(content)
}

function isLikelyOpenAITextModel(model: string) {
  const normalized = model.trim().toLowerCase()
  return normalized.startsWith('gpt-') || /^o\d/.test(normalized)
}

function resolveGenerationModel(
  requestedModel: string | undefined,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
) {
  const textModel = resolveModel(requestedModel)

  if (isLikelyOpenAITextModel(textModel) && shouldUseImageGeneration(messages)) {
    return env.OPENAI_IMAGE_MODEL
  }

  return textModel
}

function formatAttachmentSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  const units = ['KB', 'MB', 'GB']
  let nextSize = size / 1024
  let unitIndex = 0

  while (nextSize >= 1024 && unitIndex < units.length - 1) {
    nextSize /= 1024
    unitIndex += 1
  }

  return `${nextSize.toFixed(nextSize >= 100 ? 0 : 1)} ${units[unitIndex]}`
}

function sanitizeTextForJson(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeAttachmentsForStorage(attachments: Array<z.infer<typeof chatAttachmentSchema>>) {
  return attachments.map((attachment) => ({
    ...attachment,
    name: sanitizeTextForJson(attachment.name),
    mimeType: sanitizeTextForJson(attachment.mimeType),
    ...(attachment.textContent
      ? {
          textContent: sanitizeTextForJson(attachment.textContent),
        }
      : {}),
    ...(attachment.imageDataUrl
      ? {
          imageDataUrl: attachment.imageDataUrl,
        }
      : {}),
  }))
}

function buildAttachmentContext(attachments: Array<z.infer<typeof chatAttachmentSchema>>) {
  if (attachments.length === 0) {
    return ''
  }

  const parts = attachments.map((attachment, index) => {
    const sanitizedName = sanitizeTextForJson(attachment.name)
    const sanitizedMimeType = sanitizeTextForJson(attachment.mimeType)
    const sanitizedTextContent = attachment.textContent ? sanitizeTextForJson(attachment.textContent) : ''
    const header = `Attachment ${index + 1}: ${sanitizedName} (${sanitizedMimeType}, ${formatAttachmentSize(attachment.size)})`
    const textPart = sanitizedTextContent ? `\n\nParsed content:\n${sanitizedTextContent}` : ''
    return `${header}${textPart}`
  })

  return `\n\nAttached files:\n${parts.join('\n\n---\n\n')}`
}

function toOpenAIInputMessage(message: z.infer<typeof chatMessageSchema>) {
  if (message.role !== 'user') {
    return {
      role: message.role,
      content: message.content,
    }
  }

  const attachments = message.attachments ?? []
  if (attachments.length === 0) {
    return {
      role: message.role,
      content: message.content,
    }
  }

  const attachmentContext = buildAttachmentContext(attachments)
  const contentWithAttachments = `${message.content}${attachmentContext}`

  const imageBlocks = attachments
    .filter((attachment) => Boolean(attachment.imageDataUrl))
    .map((attachment) => ({
      type: 'input_image' as const,
      image_url: attachment.imageDataUrl as string,
      detail: 'auto' as const,
    }))

  if (imageBlocks.length === 0) {
    return {
      role: message.role,
      content: contentWithAttachments,
    }
  }

  const textBlock = {
    type: 'input_text' as const,
    text: contentWithAttachments,
  }

  return {
    role: message.role,
    content: [textBlock, ...imageBlocks],
  }
}

type SerializableCitation = {
  id: string
  href: string
  title: string
  domain?: string
  favicon?: string
}

function normalizeDomain(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

function buildFaviconUrl(domain?: string) {
  if (!domain) {
    return undefined
  }

  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`
}

function normalizeFaviconUrl(candidate: string | undefined, domain?: string) {
  if (!candidate) {
    return undefined
  }

  const trimmed = candidate.trim()
  if (!trimmed) {
    return undefined
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  if (trimmed.startsWith('/') && domain) {
    return `https://${domain}${trimmed}`
  }

  return undefined
}

function collectFallbackCitations(input: unknown) {
  const found: Array<{ href: string; title?: string; favicon?: string }> = []
  const seen = new WeakSet<object>()

  const visit = (node: unknown, parentKey?: string) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, parentKey)
      }
      return
    }

    if (!node || typeof node !== 'object') {
      return
    }

    if (seen.has(node)) {
      return
    }
    seen.add(node)

    const record = node as Record<string, unknown>
    const urlValue = record.url
    const titleValue = record.title
    const typeValue = record.type
    const faviconCandidate =
      (typeof record.favicon === 'string' ? record.favicon : undefined) ??
      (typeof record.favicon_url === 'string' ? record.favicon_url : undefined) ??
      (typeof record.icon === 'string' ? record.icon : undefined) ??
      (typeof record.icon_url === 'string' ? record.icon_url : undefined)

    const shouldTreatAsCitationLike =
      parentKey === 'sources' || parentKey === 'annotations' || parentKey === 'url_citation' || typeValue === 'url_citation'

    if (shouldTreatAsCitationLike && typeof urlValue === 'string' && /^https?:\/\//i.test(urlValue)) {
      const domain = normalizeDomain(urlValue)
      found.push({
        href: urlValue,
        title: typeof titleValue === 'string' ? titleValue : undefined,
        favicon: normalizeFaviconUrl(faviconCandidate, domain),
      })
    }

    const nestedCitation = record.url_citation
    if (nestedCitation && typeof nestedCitation === 'object') {
      const nested = nestedCitation as Record<string, unknown>
      if (typeof nested.url === 'string' && /^https?:\/\//i.test(nested.url)) {
        const domain = normalizeDomain(nested.url)
        found.push({
          href: nested.url,
          title: typeof nested.title === 'string' ? nested.title : undefined,
          favicon: normalizeFaviconUrl(
            (typeof nested.favicon === 'string' ? nested.favicon : undefined) ??
              (typeof nested.favicon_url === 'string' ? nested.favicon_url : undefined) ??
              (typeof nested.icon === 'string' ? nested.icon : undefined) ??
              (typeof nested.icon_url === 'string' ? nested.icon_url : undefined),
            domain,
          ),
        })
      }
      visit(nestedCitation, 'url_citation')
    }

    for (const [key, value] of Object.entries(record)) {
      visit(value, key)
    }
  }

  visit(input)
  return found
}

function extractTextAndCitations(output: unknown, rawResponse?: unknown) {
  const parsedOutput = z.array(responseOutputItemSchema).safeParse(output)
  const textParts: string[] = []
  const citationsByUrl = new Map<string, SerializableCitation>()
  let citationIndex = 0

  const addCitation = (href: string, title?: string, favicon?: string) => {
    if (!href) {
      return
    }

    const domain = normalizeDomain(href)
    const normalizedFavicon = normalizeFaviconUrl(favicon, domain) ?? buildFaviconUrl(domain)

    const existing = citationsByUrl.get(href)
    if (existing) {
      citationsByUrl.set(href, {
        ...existing,
        title: existing.title || title?.trim() || domain || 'Web source',
        domain: existing.domain ?? domain,
        favicon: existing.favicon ?? normalizedFavicon,
      })
      return
    }

    citationIndex += 1
    citationsByUrl.set(href, {
      id: `citation-${citationIndex}`,
      href,
      title: title?.trim() || domain || 'Web source',
      domain,
      favicon: normalizedFavicon,
    })
  }

  let searchedWeb = false

  if (parsedOutput.success) {
    searchedWeb = parsedOutput.data.some(
      (item) => item.type === 'web_search_call' && item.action === 'search',
    )

    for (const item of parsedOutput.data) {
      if (item.type === 'web_search_call' && Array.isArray(item.sources)) {
        for (const source of item.sources) {
          if (!source.url) {
            continue
          }

          addCitation(
            source.url,
            source.title,
            source.favicon ?? source.favicon_url ?? source.icon ?? source.icon_url,
          )
        }
      }

      if (item.type !== 'message' || !item.content) {
        continue
      }

      for (const contentPart of item.content) {
        if (contentPart.type !== 'output_text') {
          continue
        }

        if (typeof contentPart.text === 'string' && contentPart.text.trim()) {
          textParts.push(contentPart.text.trim())
        }

        if (!contentPart.annotations) {
          continue
        }

        for (const annotation of contentPart.annotations) {
          const parsedAnnotation = urlCitationAnnotationSchema.safeParse(annotation)
          if (!parsedAnnotation.success) {
            continue
          }

          const href = parsedAnnotation.data.url ?? parsedAnnotation.data.url_citation?.url
          if (!href) {
            continue
          }

          const title = parsedAnnotation.data.title ?? parsedAnnotation.data.url_citation?.title
          addCitation(href, title)
        }
      }
    }
  }

  const fallbackEntries = collectFallbackCitations(rawResponse ?? output)
  for (const entry of fallbackEntries) {
    addCitation(entry.href, entry.title, entry.favicon)
  }

  return {
    text: textParts.join('\n\n').trim(),
    citations: Array.from(citationsByUrl.values()),
    searchedWeb,
  }
}

function extractModelThinking(output: unknown) {
  const parsedOutput = z.array(responseOutputItemSchema).safeParse(output)
  if (!parsedOutput.success) {
    return null
  }

  const summaryParts: string[] = []

  for (const item of parsedOutput.data) {
    if (item.type === 'reasoning' && Array.isArray(item.summary)) {
      for (const entry of item.summary) {
        if (typeof entry.text === 'string' && entry.text.trim()) {
          summaryParts.push(entry.text.trim())
        }
      }
      continue
    }

    if (item.type === 'web_search_call') {
      if (item.action === 'search' && Array.isArray(item.queries) && item.queries.length > 0) {
        summaryParts.push(`Searching web for: ${item.queries.join(', ')}`)
      }

      if (item.action === 'open_page') {
        summaryParts.push('Reviewing source pages')
      }

      if (item.action === 'find_in_page') {
        summaryParts.push('Finding details in sources')
      }
    }
  }

  const normalized = summaryParts.join(' ').trim()
  return normalized || null
}

function sanitizeAssistantText(text: string) {
  const lines = text.split('\n')
  const cleanedLines: string[] = []
  let skippingCitationSection = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (/^(?:#{1,6}\s*)?(?:highlights?|references?|.*\bsources?\b.*)\s*:?$/i.test(trimmed)) {
      skippingCitationSection = true
      continue
    }

    if (skippingCitationSection) {
      if (trimmed.length === 0) {
        skippingCitationSection = false
      }
      continue
    }

    cleanedLines.push(line)
  }

  const normalizedText = cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()

  // Keep markdown image syntax intact. Stripping markdown links would remove
  // the image URL and break rendering in chat.
  if (/!\[[^\]]*\]\((?:<(?:data:image\/|https?:\/\/)[^>]+>|(?:data:image\/|https?:\/\/)[^)]+)\)/i.test(normalizedText)) {
    return normalizedText
  }

  return normalizedText
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$1')
    .replace(/\s*\((?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^)]*)?\)/gi, '')
    .trim()
}

function collectGeneratedImageUrls(input: unknown) {
  const urls: string[] = []
  const seen = new Set<string>()
  const visited = new WeakSet<object>()

  const addUrl = (candidate: string) => {
    const trimmed = candidate.trim()
    if (!trimmed || seen.has(trimmed)) {
      return
    }

    if (/^https?:\/\//i.test(trimmed) || /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmed)) {
      seen.add(trimmed)
      urls.push(trimmed)
    }
  }

  const addDataUrl = (base64Data: string) => {
    const trimmed = base64Data.trim()
    if (!trimmed) {
      return
    }

    // Accept only plausible base64 payloads to avoid treating arbitrary strings
    // as image bytes.
    if (!/^[A-Za-z0-9+/=]+$/.test(trimmed) || trimmed.length < 128) {
      return
    }

    addUrl(`data:image/png;base64,${trimmed}`)
  }

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item)
      }
      return
    }

    if (!node || typeof node !== 'object') {
      return
    }

    if (visited.has(node)) {
      return
    }
    visited.add(node)

    const record = node as Record<string, unknown>
    const urlCandidates = [record.url, record.image_url, record.imageUrl, record.output_url, record.outputUrl]
    for (const candidate of urlCandidates) {
      if (typeof candidate === 'string') {
        addUrl(candidate)
      }
    }

    const base64Candidates = [record.b64_json, record.base64, record.image_base64]
    for (const candidate of base64Candidates) {
      if (typeof candidate === 'string') {
        addDataUrl(candidate)
      }
    }

    for (const value of Object.values(record)) {
      visit(value)
    }
  }

  visit(input)
  return urls
}

function buildGeneratedImageMarkdown(imageUrls: string[]) {
  return imageUrls
    .map((url, index) => {
      // Use CommonMark angle-bracket destinations so URLs with special characters
      // don't break markdown image parsing.
      const safeUrl = url.replace(/</g, '%3C').replace(/>/g, '%3E')
      return `![Generated image ${index + 1}](<${safeUrl}>)`
    })
    .join('\n\n')
    .trim()
}

function toTitleCase(input: string) {
  const minorWords = new Set([
    'a',
    'an',
    'and',
    'as',
    'at',
    'by',
    'for',
    'from',
    'in',
    'into',
    'of',
    'on',
    'or',
    'the',
    'to',
    'with',
  ])

  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index, allWords) => {
      const lower = word.toLowerCase()
      const isEdgeWord = index === 0 || index === allWords.length - 1
      const preserveUppercase = /^[A-Z0-9]{2,}$/.test(word)

      if (preserveUppercase) {
        return word
      }

      if (!isEdgeWord && minorWords.has(lower)) {
        return lower
      }

      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
    })
    .join(' ')
}

function normalizeTitleCandidate(input: string) {
  const trimmed = input
    .replace(/`{3}[\s\S]*?`{3}/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!trimmed) {
    return ''
  }

  const withoutLeadIn = trimmed
    .replace(/^(please\s+)?(?:(?:can|could|would)\s+you\s+|i(?:'d|\s+would)?\s+like\s+to\s+|i\s+need\s+to\s+|help\s+me(?:\s+to)?\s+|let'?s\s+|pls\s+)/i, '')
    .replace(/^(?:write|create|build|code|generate|draft|design|develop|make)\s+(?:me\s+)?/i, '')
    .replace(/^(?:what\s+is|what\s+are|explain|define|tell\s+me\s+about|describe)\s+/i, '')
    .replace(/^(?:a|an|the)\s+/i, '')
    .replace(/\busing\b/gi, 'with')
    .replace(/["'“”‘’]+/g, '')
    .replace(/[?!]+$/g, '')
    .trim()

  if (!withoutLeadIn) {
    return ''
  }

  const words = withoutLeadIn
    .split(/\s+/)
    .map((word) => word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter(Boolean)

  if (words.length === 0) {
    return ''
  }

  const softStopWords = new Set(['simple', 'quick', 'basic', 'please'])
  const filteredWords = words.filter((word, index) => {
    if (index === 0) {
      return true
    }

    return !softStopWords.has(word.toLowerCase())
  })

  const capped = filteredWords.slice(0, 9).join(' ')
  return toTitleCase(capped)
}

function buildSessionTitle(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  assistantResponse?: string,
) {
  const userMessages = messages.filter((message) => message.role === 'user')

  const latestUserMessage = userMessages.at(-1)?.content ?? ''
  const latestNormalized = normalizeTitleCandidate(latestUserMessage)
  if (latestNormalized) {
    return latestNormalized.slice(0, 80)
  }

  const firstUserMessages = userMessages
    .slice(0, 2)
    .map((message) => message.content)
    .join(' ')

  const combinedNormalized = normalizeTitleCandidate(firstUserMessages)
  if (combinedNormalized) {
    return combinedNormalized.slice(0, 80)
  }

  if (assistantResponse) {
    const assistantNormalized = normalizeTitleCandidate(assistantResponse)
    if (assistantNormalized) {
      return assistantNormalized.slice(0, 80)
    }
  }

  return 'New chat'
}

async function getSessionFromRequest(request: FastifyRequest) {
  const token = getSessionTokenFromRequest(request)
  if (!token) {
    return null
  }

  const rawSession = await redisClient.get(`session:${token}`)
  if (!rawSession) {
    return null
  }

  try {
    const parsed = JSON.parse(rawSession) as Partial<RawSessionData>
    const normalizedUserId =
      parsed.userId === undefined ? null : normalizeUserId(parsed.userId)

    if (normalizedUserId === null || typeof parsed.email !== 'string') {
      return null
    }

    return {
      userId: normalizedUserId,
      email: parsed.email,
    }
  } catch {
    return null
  }
}

function buildCompletionInput(
  messages: Array<z.infer<typeof chatMessageSchema>>,
  activateWebSearch: boolean,
  activateLearningMode: boolean,
  personalizedSystemPrompt: string,
  memoryPrompt: string,
) {
  return [
    {
      role: 'system' as const,
      content: personalizedSystemPrompt,
    },
    ...(memoryPrompt
      ? [
          {
            role: 'system' as const,
            content: memoryPrompt,
          },
        ]
      : []),
    {
      role: 'system' as const,
      content: visualizationSystemPrompt,
    },
    ...(activateLearningMode
      ? [
          {
            role: 'system' as const,
            content: learningModeSystemPrompt,
          },
        ]
      : []),
    ...(activateWebSearch
      ? [
          {
            role: 'system' as const,
            content: webSearchSystemPrompt,
          },
        ]
      : []),
    ...messages.map((message) => toOpenAIInputMessage(message)),
  ]
}

type GenerationTaskPayload = {
  generationId: string
  userId: number
  chatSessionId: string
  model: string
  activateWebSearch: boolean
  activateLearningMode: boolean
  persistChatHistory: boolean
  messages: Array<z.infer<typeof chatMessageSchema>>
}

const fallbackOpenAIImageModel = 'gpt-image-1'

async function markGenerationFailed(generationId: string, message: string) {
  await pgPool.query(
    `
    UPDATE chat_generations
    SET status = 'failed', error_message = $2, updated_at = NOW(), completed_at = NOW()
    WHERE id = $1
    `,
    [generationId, message],
  )
}

async function runGenerationTask(payload: GenerationTaskPayload) {
  if (!openaiClient) {
    await markGenerationFailed(payload.generationId, 'OPENAI_API_KEY is not configured on the backend')
    return
  }

  await pgPool.query(
    `
    UPDATE chat_generations
    SET status = 'in_progress', updated_at = NOW(), error_message = NULL
    WHERE id = $1
    `,
    [payload.generationId],
  )

  const imageModelNormalized = env.OPENAI_IMAGE_MODEL.trim().toLowerCase()
  const isImageGenerationModel = payload.model.trim().toLowerCase() === imageModelNormalized

  const tools = payload.activateWebSearch && !isImageGenerationModel
    ? [
        {
          type: 'web_search' as const,
        },
      ]
    : undefined

  const lastUserMessage = [...payload.messages].reverse().find((message) => message.role === 'user')
  const autoCandidates = await inferAutoMemoryCandidates(lastUserMessage?.content ?? '')
  if (autoCandidates.length > 0) {
    try {
      await upsertUserMemories(payload.userId, autoCandidates, 'auto', payload.chatSessionId)
    } catch (memoryError) {
      app.log.warn(
        {
          generationId: payload.generationId,
          userId: payload.userId,
          error: memoryError,
        },
        'unable to persist auto-detected user memories',
      )
    }
  }

  const personalizationProfile = await loadPersonalizationProfile(payload.userId)
  const userMemories = await loadUserMemoryCandidates(payload.userId, payload.chatSessionId)
  const identityMemories = userMemories.filter((memory) => memory.category === 'identity')
  const nonIdentityMemories = userMemories.filter((memory) => memory.category !== 'identity')
  const rankedNonIdentity = await selectRelevantMemories(
    lastUserMessage?.content ?? '',
    nonIdentityMemories,
    MEMORY_RETRIEVAL_TOP_K,
  )
  const relevantMemories = mergeAndDedupeMemories(identityMemories, rankedNonIdentity)
  if (relevantMemories.length > 0) {
    await touchUserMemories(relevantMemories.map((memory) => memory.id))
  }
  const personalizedSystemPrompt = buildPersonalizedSystemPrompt(personalizationProfile)
  const memoryPromptPayload = buildMemoryPrompt(relevantMemories)
  const memoryPrompt = memoryPromptPayload.prompt
  const usedMemoryContext = memoryPromptPayload.usedMemories

  const completionRequest = {
    model: payload.model,
    ...(tools ? { tools } : {}),
    input: buildCompletionInput(
      payload.messages,
      payload.activateWebSearch,
      payload.activateLearningMode,
      personalizedSystemPrompt,
      memoryPrompt,
    ),
  }

  let text = ''
  let modelThinking: string | null = null
  let assistantSearchedWeb = false
  let citations: SerializableCitation[] = []
  let modelUsed = payload.model

  if (isImageGenerationModel) {
    const lastUserPrompt = [...payload.messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content.trim()

    if (!lastUserPrompt) {
      await markGenerationFailed(payload.generationId, 'Image generation requires a user prompt')
      return
    }

    let imageResponse: unknown

    try {
      imageResponse = await (openaiClient.images as any).generate({
        model: payload.model,
        prompt: lastUserPrompt,
        size: '1024x1024',
      })
    } catch (imageError) {
      const message = imageError instanceof Error ? imageError.message.toLowerCase() : ''
      const shouldFallback =
        payload.model.trim().toLowerCase() !== fallbackOpenAIImageModel &&
        (message.includes('does not exist') || message.includes('unknown model') || message.includes('invalid model'))

      if (!shouldFallback) {
        throw imageError
      }

      app.log.warn(
        {
          generationId: payload.generationId,
          requestedModel: payload.model,
          fallbackModel: fallbackOpenAIImageModel,
          error: imageError,
        },
        'configured image model unavailable; retrying with fallback image model',
      )

      imageResponse = await (openaiClient.images as any).generate({
        model: fallbackOpenAIImageModel,
        prompt: lastUserPrompt,
        size: '1024x1024',
      })
      modelUsed = fallbackOpenAIImageModel
    }

    const generatedImageUrls = collectGeneratedImageUrls(imageResponse)
    const markdownImages = buildGeneratedImageMarkdown(generatedImageUrls)

    if (!markdownImages) {
      await markGenerationFailed(payload.generationId, 'OpenAI image generation did not return an image')
      return
    }

    text = markdownImages
  } else {
    let streamedText = ''
    let streamedFlushLength = 0
    let streamedFlushTime = 0
    let response: unknown = null

    try {
      const stream = await (openaiClient.responses as any).stream(completionRequest)

      for await (const event of stream as AsyncIterable<{ type?: string; delta?: string }>) {
        if (event.type !== 'response.output_text.delta' || typeof event.delta !== 'string') {
          continue
        }

        streamedText += event.delta

        const shouldFlushByLength = streamedText.length - streamedFlushLength >= 80
        const now = Date.now()
        const shouldFlushByTime = now - streamedFlushTime >= 600

        if (shouldFlushByLength || shouldFlushByTime) {
          await pgPool.query(
            `
            UPDATE chat_generations
            SET response_text = $2, updated_at = NOW()
            WHERE id = $1
            `,
            [payload.generationId, streamedText],
          )
          streamedFlushLength = streamedText.length
          streamedFlushTime = now
        }
      }

      response = await stream.finalResponse()
    } catch (streamError) {
      app.log.warn(
        {
          generationId: payload.generationId,
          error: streamError,
        },
        'openai streaming unavailable; falling back to non-streaming response',
      )

      response = await openaiClient.responses.create(completionRequest)
    }

    const responseRecord = response as {
      output?: unknown
      output_text?: string
    }

    const extracted = extractTextAndCitations(responseRecord.output, responseRecord)
    modelThinking = extractModelThinking(responseRecord.output)
    const fallbackText = typeof responseRecord.output_text === 'string' ? responseRecord.output_text.trim() : ''
    const rawText = extracted.text || fallbackText || streamedText
    text = sanitizeAssistantText(rawText)
    assistantSearchedWeb = extracted.searchedWeb || extracted.citations.length > 0
    citations = extracted.citations
  }

  if (!text) {
    await markGenerationFailed(payload.generationId, 'OpenAI returned an empty response')
    return
  }

  const sessionTitle = buildSessionTitle(payload.messages, text)

  const dbClient = await pgPool.connect()
  try {
    await dbClient.query('BEGIN')

    const updatedSessionResult = await dbClient.query<{ title: string }>(
      `
      UPDATE chat_conversations
      SET
        title = CASE
          WHEN title = 'New chat' THEN $2
          ELSE title
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING title
      `,
      [payload.chatSessionId, sessionTitle],
    )

    const persistedSessionTitle = updatedSessionResult.rows[0]?.title ?? sessionTitle

    if (payload.persistChatHistory) {
      await dbClient.query('DELETE FROM chat_messages WHERE conversation_id = $1', [payload.chatSessionId])

      const persistedMessages = [
        ...payload.messages
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .map((message) => ({
            role: message.role as 'user' | 'assistant',
            content: message.content,
            attachments:
              message.role === 'user'
                ? sanitizeAttachmentsForStorage(message.attachments ?? [])
                : [],
            citations: Array.isArray(message.citations) ? message.citations : [],
            memoryContext: [] as UsedMemoryContext[],
            searchedWeb: Boolean(message.searchedWeb),
            thinking: null as string | null,
            model: modelUsed,
          })),
        {
          role: 'assistant' as const,
          content: text,
          attachments: [],
          citations,
          memoryContext: usedMemoryContext,
          searchedWeb: assistantSearchedWeb,
          thinking: modelThinking,
          model: modelUsed,
        },
      ]

      for (const message of persistedMessages) {
        await dbClient.query(
          `
          INSERT INTO chat_messages (
            conversation_id,
            user_id,
            role,
            content,
            model,
            attachments_json,
            citations_json,
            memory_context_json,
            searched_web,
            thinking_text
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
          `,
          [
            payload.chatSessionId,
            payload.userId,
            message.role,
            message.content,
            message.model,
            JSON.stringify(message.attachments),
            JSON.stringify(message.citations),
            JSON.stringify(message.memoryContext),
            message.searchedWeb,
            message.thinking,
          ],
        )
      }
    }

    await dbClient.query(
      `
      UPDATE chat_generations
      SET
        status = 'completed',
        response_text = $2,
        citations_json = $3::jsonb,
        memory_context_json = $4::jsonb,
        searched_web = $5,
        thinking_text = $6,
        error_message = NULL,
        updated_at = NOW(),
        completed_at = NOW()
      WHERE id = $1
      `,
      [
        payload.generationId,
        text,
        JSON.stringify(citations),
        JSON.stringify(usedMemoryContext),
        assistantSearchedWeb,
        modelThinking,
      ],
    )

    await dbClient.query('COMMIT')

    app.log.info(
      {
        generationId: payload.generationId,
        sessionId: payload.chatSessionId,
        sessionTitle: persistedSessionTitle,
        persistChatHistory: payload.persistChatHistory,
      },
      'chat generation completed',
    )

    if (!payload.persistChatHistory) {
      setTimeout(() => {
        void pgPool
          .query(
            `
            DELETE FROM chat_conversations
            WHERE id = $1 AND user_id = $2
            `,
            [payload.chatSessionId, payload.userId],
          )
          .catch((cleanupError) => {
            app.log.warn(
              {
                chatSessionId: payload.chatSessionId,
                error: cleanupError,
              },
              'failed to cleanup ephemeral chat session',
            )
          })
      }, 5000)
    }
  } catch (dbError) {
    await dbClient.query('ROLLBACK')
    throw dbError
  } finally {
    dbClient.release()
  }
}

app.get('/health', async () => {
  await Promise.all([checkPostgresConnection(), checkRedisConnection()])

  return {
    status: 'ok',
    services: {
      postgres: 'up',
      redis: 'up',
    },
    timestamp: new Date().toISOString(),
  }
})

app.post('/auth/signup', async (request, reply) => {
  try {
    const body = signUpSchema.parse(request.body)
    const passwordHash = await bcrypt.hash(body.password, 12)

    const result = await pgPool.query<{ id: number | string; email: string }>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [body.email, passwordHash],
    )

    const createdUser = result.rows[0]
    const userId = normalizeUserId(createdUser.id)
    if (userId === null) {
      return reply.code(500).send({
        message: 'Unable to create account',
      })
    }
    const sessionToken = randomUUID()

    await redisClient.set(
      `session:${sessionToken}`,
      JSON.stringify({ userId, email: createdUser.email }),
      {
        EX: env.SESSION_TTL_SECONDS,
      },
    )

    return reply.code(201).send({
      user: {
        id: userId,
        email: createdUser.email,
      },
      token: sessionToken,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid signup payload',
        issues: error.issues,
      })
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      return reply.code(409).send({
        message: 'An account already exists for that email',
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to create account',
    })
  }
})

app.post('/auth/signin', async (request, reply) => {
  try {
    const body = signInSchema.parse(request.body)
    const result = await pgPool.query<{
      id: number | string
      email: string
      password_hash: string
    }>('SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1', [
      body.email,
    ])

    const user = result.rows[0]
    if (!user) {
      return reply.code(401).send({
        message: 'Invalid email or password',
      })
    }

    const isValidPassword = await bcrypt.compare(body.password, user.password_hash)
    if (!isValidPassword) {
      return reply.code(401).send({
        message: 'Invalid email or password',
      })
    }

    const userId = normalizeUserId(user.id)
    if (userId === null) {
      return reply.code(500).send({
        message: 'Unable to sign in',
      })
    }

    const sessionToken = randomUUID()
    await redisClient.set(
      `session:${sessionToken}`,
      JSON.stringify({ userId, email: user.email }),
      {
        EX: env.SESSION_TTL_SECONDS,
      },
    )

    return reply.send({
      user: {
        id: userId,
        email: user.email,
      },
      token: sessionToken,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid signin payload',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to sign in',
    })
  }
})

app.get('/account/profile', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const result = await pgPool.query<{
      id: number
      email: string
      full_name: string | null
      nickname: string | null
      avatar_url: string | null
      base_style_tone: BaseStyleTone | null
      warmth_level: CharacteristicLevel | null
      enthusiasm_level: CharacteristicLevel | null
      headers_level: CharacteristicLevel | null
      emojis_level: CharacteristicLevel | null
      custom_instructions: string | null
      occupation: string | null
      more_about_you: string | null
    }>(
      `
      SELECT
        users.id,
        users.email,
        onboarding_profiles.full_name,
        onboarding_profiles.nickname,
        onboarding_profiles.avatar_url,
        onboarding_profiles.base_style_tone,
        onboarding_profiles.warmth_level,
        onboarding_profiles.enthusiasm_level,
        onboarding_profiles.headers_level,
        onboarding_profiles.emojis_level,
        onboarding_profiles.custom_instructions,
        onboarding_profiles.occupation,
        onboarding_profiles.more_about_you
      FROM users
      LEFT JOIN onboarding_profiles ON onboarding_profiles.user_id = users.id
      WHERE users.id = $1
      LIMIT 1
      `,
      [session.userId],
    )

    const profile = result.rows[0]
    if (!profile) {
      return reply.code(404).send({
        message: 'Account profile not found',
      })
    }

    return reply.send({
      profile: {
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name ?? '',
        nickname: profile.nickname ?? '',
        avatarDataUrl: profile.avatar_url ?? null,
        baseStyleTone: parseBaseStyleTone(profile.base_style_tone),
        warmth: parseCharacteristicLevel(profile.warmth_level),
        enthusiasm: parseCharacteristicLevel(profile.enthusiasm_level),
        headers: parseCharacteristicLevel(profile.headers_level),
        emojis: parseCharacteristicLevel(profile.emojis_level),
        customInstructions: profile.custom_instructions ?? '',
        occupation: profile.occupation ?? '',
        moreAboutYou: profile.more_about_you ?? '',
      },
    })
  } catch (error) {
    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to load account profile',
    })
  }
})

app.patch('/account/profile', async (request, reply) => {
  const sessionToken = getSessionTokenFromRequest(request)
  if (!sessionToken) {
    return reply.code(401).send({
      message: 'Unauthorized',
    })
  }

  const session = await getSessionFromRequest(request)
  if (!session) {
    return reply.code(401).send({
      message: 'Unauthorized',
    })
  }

  const client = await pgPool.connect()

  try {
    const body = accountProfileSchema.parse(request.body)
    const nickname = body.nickname?.trim() || body.fullName.trim().split(/\s+/)[0] || body.fullName.trim()
    const baseStyleTone = body.baseStyleTone ?? 'default'
    const warmth = body.warmth ?? 'default'
    const enthusiasm = body.enthusiasm ?? 'default'
    const headers = body.headers ?? 'default'
    const emojis = body.emojis ?? 'default'
    const customInstructions = body.customInstructions?.trim() ?? ''
    const occupation = body.occupation?.trim() ?? ''
    const moreAboutYou = body.moreAboutYou?.trim() ?? ''

    await client.query('BEGIN')

    const userResult = await client.query<{
      id: number
      email: string
    }>(
      `
      UPDATE users
      SET email = $2
      WHERE id = $1
      RETURNING id, email
      `,
      [session.userId, body.email],
    )

    const updatedUser = userResult.rows[0]
    if (!updatedUser) {
      await client.query('ROLLBACK')
      return reply.code(404).send({
        message: 'Account profile not found',
      })
    }

    const profileResult = await client.query<{
      full_name: string
      nickname: string
      avatar_url: string | null
      base_style_tone: BaseStyleTone
      warmth_level: CharacteristicLevel
      enthusiasm_level: CharacteristicLevel
      headers_level: CharacteristicLevel
      emojis_level: CharacteristicLevel
      custom_instructions: string | null
      occupation: string | null
      more_about_you: string | null
    }>(
      `
      INSERT INTO onboarding_profiles (
        user_id,
        full_name,
        nickname,
        avatar_url,
        base_style_tone,
        warmth_level,
        enthusiasm_level,
        headers_level,
        emojis_level,
        custom_instructions,
        occupation,
        more_about_you
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        nickname = EXCLUDED.nickname,
        avatar_url = EXCLUDED.avatar_url,
        base_style_tone = EXCLUDED.base_style_tone,
        warmth_level = EXCLUDED.warmth_level,
        enthusiasm_level = EXCLUDED.enthusiasm_level,
        headers_level = EXCLUDED.headers_level,
        emojis_level = EXCLUDED.emojis_level,
        custom_instructions = EXCLUDED.custom_instructions,
        occupation = EXCLUDED.occupation,
        more_about_you = EXCLUDED.more_about_you,
        updated_at = NOW()
      RETURNING
        full_name,
        nickname,
        avatar_url,
        base_style_tone,
        warmth_level,
        enthusiasm_level,
        headers_level,
        emojis_level,
        custom_instructions,
        occupation,
        more_about_you
      `,
      [
        session.userId,
        body.fullName,
        nickname,
        body.avatarDataUrl ?? null,
        baseStyleTone,
        warmth,
        enthusiasm,
        headers,
        emojis,
        customInstructions || null,
        occupation || null,
        moreAboutYou || null,
      ],
    )

    await client.query('COMMIT')

    const sessionKey = `session:${sessionToken}`
    const serializedSession = JSON.stringify({
      userId: session.userId,
      email: updatedUser.email,
    })
    const ttlSeconds = await redisClient.ttl(sessionKey)

    if (ttlSeconds > 0) {
      await redisClient.set(sessionKey, serializedSession, { EX: ttlSeconds })
    } else {
      await redisClient.set(sessionKey, serializedSession)
    }

    const updatedProfile = profileResult.rows[0]

    return reply.send({
      profile: {
        userId: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedProfile.full_name,
        nickname: updatedProfile.nickname,
        avatarDataUrl: updatedProfile.avatar_url,
        baseStyleTone: updatedProfile.base_style_tone,
        warmth: updatedProfile.warmth_level,
        enthusiasm: updatedProfile.enthusiasm_level,
        headers: updatedProfile.headers_level,
        emojis: updatedProfile.emojis_level,
        customInstructions: updatedProfile.custom_instructions ?? '',
        occupation: updatedProfile.occupation ?? '',
        moreAboutYou: updatedProfile.more_about_you ?? '',
      },
    })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null)

    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid account profile payload',
        issues: error.issues,
      })
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      return reply.code(409).send({
        message: 'An account already exists for that email',
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to update account profile',
    })
  } finally {
    client.release()
  }
})

app.get('/account/data-controls', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const result = await pgPool.query<{ chat_history_enabled: boolean }>(
      `
      SELECT chat_history_enabled
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [session.userId],
    )

    const row = result.rows[0]
    if (!row) {
      return reply.code(404).send({
        message: 'Account not found',
      })
    }

    return reply.send({
      dataControls: {
        chatHistoryEnabled: row.chat_history_enabled,
      },
    })
  } catch (error) {
    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to load data controls',
    })
  }
})

app.patch('/account/data-controls', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const body = dataControlsSchema.parse(request.body)

    const result = await pgPool.query<{ chat_history_enabled: boolean }>(
      `
      UPDATE users
      SET chat_history_enabled = $2
      WHERE id = $1
      RETURNING chat_history_enabled
      `,
      [session.userId, body.chatHistoryEnabled],
    )

    const row = result.rows[0]
    if (!row) {
      return reply.code(404).send({
        message: 'Account not found',
      })
    }

    return reply.send({
      dataControls: {
        chatHistoryEnabled: row.chat_history_enabled,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid data controls payload',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to update data controls',
    })
  }
})

app.get('/account/export', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const profileResult = await pgPool.query<{
      id: number
      email: string
      chat_history_enabled: boolean
      full_name: string | null
      nickname: string | null
      occupation: string | null
      more_about_you: string | null
      custom_instructions: string | null
      base_style_tone: string | null
      warmth_level: string | null
      enthusiasm_level: string | null
      headers_level: string | null
      emojis_level: string | null
      avatar_url: string | null
      created_at: string
    }>(
      `
      SELECT
        users.id,
        users.email,
        users.chat_history_enabled,
        users.created_at,
        onboarding_profiles.full_name,
        onboarding_profiles.nickname,
        onboarding_profiles.occupation,
        onboarding_profiles.more_about_you,
        onboarding_profiles.custom_instructions,
        onboarding_profiles.base_style_tone,
        onboarding_profiles.warmth_level,
        onboarding_profiles.enthusiasm_level,
        onboarding_profiles.headers_level,
        onboarding_profiles.emojis_level,
        onboarding_profiles.avatar_url
      FROM users
      LEFT JOIN onboarding_profiles ON onboarding_profiles.user_id = users.id
      WHERE users.id = $1
      LIMIT 1
      `,
      [session.userId],
    )

    const sessionsResult = await pgPool.query<{
      id: string
      title: string
      created_at: string
      updated_at: string
    }>(
      `
      SELECT id, title, created_at, updated_at
      FROM chat_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      `,
      [session.userId],
    )

    const messagesResult = await pgPool.query<{
      conversation_id: string
      role: 'user' | 'assistant'
      content: string
      model: string | null
      attachments_json: unknown
      citations_json: unknown
      memory_context_json: unknown
      searched_web: boolean
      thinking_text: string | null
      created_at: string
    }>(
      `
      SELECT
        conversation_id,
        role,
        content,
        model,
        attachments_json,
        citations_json,
        memory_context_json,
        searched_web,
        thinking_text,
        created_at
      FROM chat_messages
      WHERE user_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [session.userId],
    )

    const memoriesResult = await pgPool.query<{
      id: string
      content: string
      source: MemorySource
      memory_type: MemoryCategory
      scope_type: MemoryScope
      session_id: string | null
      confidence_score: number | null
      expires_at: string | null
      importance_score: number | null
      usage_count: number | null
      created_at: string
      updated_at: string
    }>(
      `
      SELECT id, content, source, memory_type, scope_type, session_id, confidence_score, expires_at, importance_score, usage_count, created_at, updated_at
      FROM user_memories
      WHERE user_id = $1
      ORDER BY updated_at DESC
      `,
      [session.userId],
    )

    const profile = profileResult.rows[0]
    if (!profile) {
      return reply.code(404).send({
        message: 'Account not found',
      })
    }

    return reply.send({
      exportedAt: new Date().toISOString(),
      account: {
        id: profile.id,
        email: profile.email,
        createdAt: profile.created_at,
        chatHistoryEnabled: profile.chat_history_enabled,
      },
      profile: {
        fullName: profile.full_name ?? '',
        nickname: profile.nickname ?? '',
        occupation: profile.occupation ?? '',
        moreAboutYou: profile.more_about_you ?? '',
        customInstructions: profile.custom_instructions ?? '',
        baseStyleTone: parseBaseStyleTone(profile.base_style_tone),
        warmth: parseCharacteristicLevel(profile.warmth_level),
        enthusiasm: parseCharacteristicLevel(profile.enthusiasm_level),
        headers: parseCharacteristicLevel(profile.headers_level),
        emojis: parseCharacteristicLevel(profile.emojis_level),
        avatarDataUrl: profile.avatar_url,
      },
      sessions: sessionsResult.rows.map((sessionRow) => ({
        id: sessionRow.id,
        title: sessionRow.title,
        createdAt: sessionRow.created_at,
        updatedAt: sessionRow.updated_at,
      })),
      messages: messagesResult.rows.map((message) => ({
        conversationId: message.conversation_id,
        role: message.role,
        content: message.content,
        model: message.model,
        attachments: Array.isArray(message.attachments_json) ? message.attachments_json : [],
        citations: Array.isArray(message.citations_json) ? message.citations_json : [],
        memoryContext: Array.isArray(message.memory_context_json) ? message.memory_context_json : [],
        searchedWeb: message.searched_web,
        thinking: message.thinking_text,
        createdAt: message.created_at,
      })),
      memories: memoriesResult.rows.map((memory) => ({
        id: memory.id,
        content: memory.content,
        source: memory.source,
        category: memory.memory_type,
        scope: memory.scope_type,
        chatSessionId: memory.session_id,
        confidenceScore: memory.confidence_score,
        expiresAt: memory.expires_at,
        importanceScore: memory.importance_score,
        usageCount: memory.usage_count,
        createdAt: memory.created_at,
        updatedAt: memory.updated_at,
      })),
    })
  } catch (error) {
    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to export data',
    })
  }
})

app.delete('/account', async (request, reply) => {
  const sessionToken = getSessionTokenFromRequest(request)
  if (!sessionToken) {
    return reply.code(401).send({
      message: 'Unauthorized',
    })
  }

  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const result = await pgPool.query<{ id: number }>(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id
      `,
      [session.userId],
    )

    if (!result.rows[0]) {
      return reply.code(404).send({
        message: 'Account not found',
      })
    }

    await redisClient.del(`session:${sessionToken}`)

    return reply.code(204).send()
  } catch (error) {
    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to delete account',
    })
  }
})

app.post('/onboarding/profile', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const body = onboardingProfileSchema.parse(request.body)

    const result = await pgPool.query<{
      user_id: number
      full_name: string
      nickname: string
      acknowledged_at: string | null
      completed_at: string | null
    }>(
      `
      INSERT INTO onboarding_profiles (
        user_id,
        full_name,
        nickname,
        acknowledged_at,
        completed_at
      )
      VALUES (
        $1,
        $2,
        $3,
        CASE WHEN $4 THEN NOW() ELSE NULL END,
        CASE WHEN $5 THEN NOW() ELSE NULL END
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        nickname = EXCLUDED.nickname,
        acknowledged_at = CASE
          WHEN $4 THEN COALESCE(onboarding_profiles.acknowledged_at, NOW())
          ELSE onboarding_profiles.acknowledged_at
        END,
        completed_at = CASE
          WHEN $5 THEN COALESCE(onboarding_profiles.completed_at, NOW())
          ELSE onboarding_profiles.completed_at
        END,
        updated_at = NOW()
      RETURNING user_id, full_name, nickname, acknowledged_at, completed_at
      `,
      [session.userId, body.fullName, body.nickname, body.acknowledged, body.completed],
    )

    const profile = result.rows[0]

    return reply.send({
      profile: {
        userId: profile.user_id,
        fullName: profile.full_name,
        nickname: profile.nickname,
        acknowledged: profile.acknowledged_at !== null,
        completed: profile.completed_at !== null,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid onboarding payload',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to save onboarding profile',
    })
  }
})

app.get('/onboarding/profile', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const result = await pgPool.query<{
      user_id: number
      full_name: string
      nickname: string
      acknowledged_at: string | null
      completed_at: string | null
    }>(
      `
      SELECT user_id, full_name, nickname, acknowledged_at, completed_at
      FROM onboarding_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [session.userId],
    )

    const profile = result.rows[0]
    if (!profile) {
      return reply.code(404).send({
        message: 'Onboarding profile not found',
      })
    }

    return reply.send({
      profile: {
        userId: profile.user_id,
        fullName: profile.full_name,
        nickname: profile.nickname,
        acknowledged: profile.acknowledged_at !== null,
        completed: profile.completed_at !== null,
      },
    })
  } catch (error) {
    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to load onboarding profile',
    })
  }
})

app.get('/memory', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const memories = await loadUserMemories(session.userId)
    return reply.send({ memories })
  } catch (error) {
    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to load memories',
    })
  }
})

app.post('/memory', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const body = memoryEntrySchema.parse(request.body)
    const contentToStore = body.summarize
      ? await summarizeMemoryContent(body.content, body.summarizeMode)
      : body.content

    const memory = await upsertUserMemory(
      session.userId,
      contentToStore || body.content,
      body.source,
      body.category,
      body.scope,
      body.chatSessionId,
      body.expiresAt,
    )
    return reply.code(201).send({ memory })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid memory payload',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to save memory',
    })
  }
})

app.patch('/memory/:memoryId', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const { memoryId } = memoryIdParamSchema.parse(request.params)
    const body = memoryEntrySchema.parse(request.body)
    const normalizedContent = normalizeMemoryContent(body.content)
    const normalizedLookup = normalizeMemoryContentForLookup(normalizedContent)

    const result = await pgPool.query<{
      id: string
      content: string
      source: MemorySource
      memory_type: MemoryCategory
      scope_type: MemoryScope
      session_id: string | null
      confidence_score: number
      expires_at: string | null
      created_at: string
      updated_at: string
    }>(
      `
      UPDATE user_memories
      SET
        content = $3,
        content_normalized = $4,
        memory_type = $5,
        scope_type = $6,
        session_id = $7,
        expires_at = $8,
        confidence_score = LEAST(1, GREATEST(COALESCE(confidence_score, 0.6), 0.85)),
        source = 'manual',
        embedding_model = NULL,
        embedding_json = NULL,
        embedding_updated_at = NULL,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, content, source, memory_type, scope_type, session_id, confidence_score, expires_at, created_at, updated_at
      `,
      [
        memoryId,
        session.userId,
        normalizedContent,
        normalizedLookup,
        body.category ?? inferMemoryCategory(body.content),
        body.scope ?? inferMemoryScope(body.content, body.category ?? inferMemoryCategory(body.content), body.chatSessionId),
        body.scope === 'session' ? body.chatSessionId ?? null : null,
        body.expiresAt ?? inferMemoryExpiry(body.content, body.category ?? inferMemoryCategory(body.content)),
      ],
    )

    const updated = result.rows[0]
    if (!updated) {
      return reply.code(404).send({
        message: 'Memory not found',
      })
    }

    return reply.send({
      memory: {
        id: updated.id,
        content: updated.content,
        source: updated.source,
        category: updated.memory_type,
        scope: updated.scope_type,
        chatSessionId: updated.session_id,
        confidenceScore: updated.confidence_score,
        expiresAt: updated.expires_at,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid memory payload',
        issues: error.issues,
      })
    }

    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return reply.code(409).send({
        message: 'That memory already exists',
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to update memory',
    })
  }
})

app.post('/memory/:memoryId/feedback', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const { memoryId } = memoryIdParamSchema.parse(request.params)
    const body = memoryFeedbackSchema.parse(request.body)
    const isUpvote = body.feedback === 'up'

    const result = await pgPool.query<{
      id: string
      content: string
      source: MemorySource
      memory_type: MemoryCategory
      scope_type: MemoryScope
      session_id: string | null
      confidence_score: number
      expires_at: string | null
      importance_score: number
      usage_count: number
      created_at: string
      updated_at: string
    }>(
      `
      UPDATE user_memories
      SET
        importance_score = LEAST(1, GREATEST(0, COALESCE(importance_score, 0.5) + $3::double precision)),
        confidence_score = LEAST(1, GREATEST(0, COALESCE(confidence_score, 0.6) + $4::double precision)),
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, content, source, memory_type, scope_type, session_id, confidence_score, expires_at, importance_score, usage_count, created_at, updated_at
      `,
      [memoryId, session.userId, isUpvote ? 0.08 : -0.08, isUpvote ? 0.06 : -0.06],
    )

    const updated = result.rows[0]
    if (!updated) {
      return reply.code(404).send({
        message: 'Memory not found',
      })
    }

    return reply.send({
      memory: {
        id: updated.id,
        content: updated.content,
        source: updated.source,
        category: updated.memory_type,
        scope: updated.scope_type,
        chatSessionId: updated.session_id,
        confidenceScore: updated.confidence_score,
        expiresAt: updated.expires_at,
        importanceScore: updated.importance_score,
        usageCount: updated.usage_count,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid memory feedback payload',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to update memory feedback',
    })
  }
})

app.delete('/memory/:memoryId', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const { memoryId } = memoryIdParamSchema.parse(request.params)

    const result = await pgPool.query<{ id: string }>(
      `
      DELETE FROM user_memories
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [memoryId, session.userId],
    )

    if (!result.rows[0]) {
      return reply.code(404).send({
        message: 'Memory not found',
      })
    }

    return reply.code(204).send()
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid memory id',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to delete memory',
    })
  }
})

app.get('/chat/sessions', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const result = await pgPool.query<{
      id: string
      title: string
      created_at: string
      updated_at: string
      parent_conversation_id: string | null
      forked_from_message_id: number | null
      generation_status: 'queued' | 'in_progress' | null
    }>(
      `
      SELECT
        c.id,
        c.title,
        c.created_at,
        c.updated_at,
        c.parent_conversation_id,
        c.forked_from_message_id,
        g.status AS generation_status
      FROM chat_conversations c
      LEFT JOIN LATERAL (
        SELECT status
        FROM chat_generations
        WHERE conversation_id = c.id AND user_id = c.user_id AND status IN ('queued', 'in_progress')
        ORDER BY created_at DESC
        LIMIT 1
      ) g ON TRUE
      WHERE c.user_id = $1
      ORDER BY c.updated_at DESC
      `,
      [session.userId],
    )

    return reply.send({
      sessions: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        parentSessionId: row.parent_conversation_id,
        forkedFromMessageId: row.forked_from_message_id,
        generationStatus: row.generation_status,
      })),
    })
  } catch (error) {
    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to load chat sessions',
    })
  }
})

app.post('/chat/sessions', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const body = createChatSessionSchema.parse(request.body ?? {})
    const chatSessionId = randomUUID()
    const title = body.title ?? 'New chat'

    const result = await pgPool.query<{
      id: string
      title: string
      created_at: string
      updated_at: string
      parent_conversation_id: string | null
      forked_from_message_id: number | null
    }>(
      `
      INSERT INTO chat_conversations (id, user_id, title, parent_conversation_id, forked_from_message_id)
      VALUES ($1, $2, $3, NULL, NULL)
      RETURNING id, title, created_at, updated_at, parent_conversation_id, forked_from_message_id
      `,
      [chatSessionId, session.userId, title],
    )

    const createdSession = result.rows[0]
    return reply.code(201).send({
      session: {
        id: createdSession.id,
        title: createdSession.title,
        createdAt: createdSession.created_at,
        updatedAt: createdSession.updated_at,
        parentSessionId: createdSession.parent_conversation_id,
        forkedFromMessageId: createdSession.forked_from_message_id,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid chat session payload',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to create chat session',
    })
  }
})

app.post('/chat/sessions/:sessionId/fork', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const { sessionId } = chatSessionIdParamSchema.parse(request.params)
    const body = forkChatSessionSchema.parse(request.body ?? {})

    const sourceSessionResult = await pgPool.query<{
      id: string
      title: string
    }>(
      `
      SELECT id, title
      FROM chat_conversations
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [sessionId, session.userId],
    )

    const sourceSession = sourceSessionResult.rows[0]
    if (!sourceSession) {
      return reply.code(404).send({
        message: 'Chat session not found',
      })
    }

    const sourceMessagesResult = await pgPool.query<{
      id: number
      role: 'user' | 'assistant'
      content: string
      model: string | null
      attachments_json: unknown
      citations_json: unknown
      memory_context_json: unknown
      searched_web: boolean
      thinking_text: string | null
    }>(
      `
      SELECT id, role, content, model, attachments_json, citations_json, memory_context_json, searched_web, thinking_text
      FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [sessionId],
    )

    const sourceMessages = sourceMessagesResult.rows
    if (body.messageIndex !== undefined && body.messageIndex >= sourceMessages.length) {
      return reply.code(400).send({
        message: 'Invalid message index for fork',
      })
    }

    const effectiveMessageIndex =
      sourceMessages.length === 0
        ? -1
        : body.messageIndex !== undefined
          ? body.messageIndex
          : sourceMessages.length - 1

    const copiedMessages =
      effectiveMessageIndex >= 0 ? sourceMessages.slice(0, effectiveMessageIndex + 1) : []
    const branchPointMessageId =
      effectiveMessageIndex >= 0 ? sourceMessages[effectiveMessageIndex]?.id ?? null : null

    const derivedTitle = body.title?.trim() || `Fork: ${sourceSession.title}`
    const nextTitle = derivedTitle.slice(0, 120)
    const forkedSessionId = randomUUID()

    const dbClient = await pgPool.connect()
    try {
      await dbClient.query('BEGIN')

      const forkedSessionResult = await dbClient.query<{
        id: string
        title: string
        created_at: string
        updated_at: string
        parent_conversation_id: string | null
        forked_from_message_id: number | null
      }>(
        `
        INSERT INTO chat_conversations (id, user_id, title, parent_conversation_id, forked_from_message_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, created_at, updated_at, parent_conversation_id, forked_from_message_id
        `,
        [forkedSessionId, session.userId, nextTitle, sessionId, branchPointMessageId],
      )

      for (const message of copiedMessages) {
        await dbClient.query(
          `
          INSERT INTO chat_messages (
            conversation_id,
            user_id,
            role,
            content,
            model,
            attachments_json,
            citations_json,
            memory_context_json,
            searched_web,
            thinking_text
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
          `,
          [
            forkedSessionId,
            session.userId,
            message.role,
            message.content,
            message.model,
            JSON.stringify(Array.isArray(message.attachments_json) ? message.attachments_json : []),
            JSON.stringify(Array.isArray(message.citations_json) ? message.citations_json : []),
            JSON.stringify(Array.isArray(message.memory_context_json) ? message.memory_context_json : []),
            Boolean(message.searched_web),
            message.thinking_text,
          ],
        )
      }

      await dbClient.query('COMMIT')

      const forkedSession = forkedSessionResult.rows[0]
      return reply.code(201).send({
        session: {
          id: forkedSession.id,
          title: forkedSession.title,
          createdAt: forkedSession.created_at,
          updatedAt: forkedSession.updated_at,
          parentSessionId: forkedSession.parent_conversation_id,
          forkedFromMessageId: forkedSession.forked_from_message_id,
        },
      })
    } catch (dbError) {
      await dbClient.query('ROLLBACK')
      throw dbError
    } finally {
      dbClient.release()
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid fork payload',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to fork chat session',
    })
  }
})

app.delete('/chat/sessions', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const result = await pgPool.query<{ id: string }>(
      `
      DELETE FROM chat_conversations
      WHERE user_id = $1
      RETURNING id
      `,
      [session.userId],
    )

    return reply.send({
      deletedCount: result.rowCount,
    })
  } catch (error) {
    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to delete all chat sessions',
    })
  }
})

app.get('/chat/sessions/:sessionId', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const { sessionId } = chatSessionIdParamSchema.parse(request.params)

    const sessionResult = await pgPool.query<{
      id: string
      title: string
      created_at: string
      updated_at: string
      parent_conversation_id: string | null
      forked_from_message_id: number | null
    }>(
      `
      SELECT id, title, created_at, updated_at, parent_conversation_id, forked_from_message_id
      FROM chat_conversations
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [sessionId, session.userId],
    )

    const existingSession = sessionResult.rows[0]
    if (!existingSession) {
      return reply.code(404).send({
        message: 'Chat session not found',
      })
    }

    const messageResult = await pgPool.query<{
      id: number
      role: 'user' | 'assistant'
      content: string
      attachments_json: unknown
      citations_json: unknown
      memory_context_json: unknown
      searched_web: boolean
      thinking_text: string | null
    }>(
      `
      SELECT id, role, content, attachments_json, citations_json, memory_context_json, searched_web, thinking_text
      FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [sessionId],
    )

    const activeGenerationResult = await pgPool.query<{
      id: string
      status: 'queued' | 'in_progress'
      response_text: string
      citations_json: unknown
      memory_context_json: unknown
      searched_web: boolean
      thinking_text: string | null
      error_message: string | null
      created_at: string
      updated_at: string
      completed_at: string | null
    }>(
      `
      SELECT id, status, response_text, citations_json, memory_context_json, searched_web, thinking_text, error_message, created_at, updated_at, completed_at
      FROM chat_generations
      WHERE conversation_id = $1 AND user_id = $2 AND status IN ('queued', 'in_progress')
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [sessionId, session.userId],
    )

    const activeGeneration = activeGenerationResult.rows[0]

    return reply.send({
      session: {
        id: existingSession.id,
        title: existingSession.title,
        createdAt: existingSession.created_at,
        updatedAt: existingSession.updated_at,
        parentSessionId: existingSession.parent_conversation_id,
        forkedFromMessageId: existingSession.forked_from_message_id,
      },
      messages: messageResult.rows.map((message) => ({
        messageId: message.id,
        role: message.role,
        content: message.content,
        ...(Array.isArray(message.attachments_json) && message.attachments_json.length > 0
          ? { attachments: message.attachments_json }
          : {}),
        ...(Array.isArray(message.citations_json) && message.citations_json.length > 0
          ? { citations: message.citations_json }
          : {}),
        ...(Array.isArray(message.memory_context_json) && message.memory_context_json.length > 0
          ? { memoryContext: message.memory_context_json }
          : {}),
        searchedWeb: Boolean(message.searched_web),
        ...(typeof message.thinking_text === 'string' && message.thinking_text.trim()
          ? { thinking: message.thinking_text }
          : {}),
      })),
      ...(activeGeneration
        ? {
            activeGeneration: {
              id: activeGeneration.id,
              status: activeGeneration.status,
              content: activeGeneration.response_text,
              citations: Array.isArray(activeGeneration.citations_json) ? activeGeneration.citations_json : [],
              memoryContext: Array.isArray(activeGeneration.memory_context_json)
                ? activeGeneration.memory_context_json
                : [],
              searchedWeb: Boolean(activeGeneration.searched_web),
              ...(typeof activeGeneration.thinking_text === 'string' && activeGeneration.thinking_text.trim()
                ? { thinking: activeGeneration.thinking_text }
                : {}),
              ...(typeof activeGeneration.error_message === 'string' && activeGeneration.error_message.trim()
                ? { errorMessage: activeGeneration.error_message }
                : {}),
              createdAt: activeGeneration.created_at,
              updatedAt: activeGeneration.updated_at,
              completedAt: activeGeneration.completed_at,
            },
          }
        : {}),
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid chat session id',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to load chat session',
    })
  }
})

app.patch('/chat/sessions/:sessionId', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const { sessionId } = chatSessionIdParamSchema.parse(request.params)
    const body = renameChatSessionSchema.parse(request.body)

    const result = await pgPool.query<{
      id: string
      title: string
      created_at: string
      updated_at: string
      parent_conversation_id: string | null
      forked_from_message_id: number | null
    }>(
      `
      UPDATE chat_conversations
      SET title = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING id, title, created_at, updated_at, parent_conversation_id, forked_from_message_id
      `,
      [body.title, sessionId, session.userId],
    )

    const updatedSession = result.rows[0]
    if (!updatedSession) {
      return reply.code(404).send({
        message: 'Chat session not found',
      })
    }

    return reply.send({
      session: {
        id: updatedSession.id,
        title: updatedSession.title,
        createdAt: updatedSession.created_at,
        updatedAt: updatedSession.updated_at,
        parentSessionId: updatedSession.parent_conversation_id,
        forkedFromMessageId: updatedSession.forked_from_message_id,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid chat session payload',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to rename chat session',
    })
  }
})

app.delete('/chat/sessions/:sessionId', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const { sessionId } = chatSessionIdParamSchema.parse(request.params)

    const result = await pgPool.query<{ id: string }>(
      `
      DELETE FROM chat_conversations
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [sessionId, session.userId],
    )

    if (!result.rows[0]) {
      return reply.code(404).send({
        message: 'Chat session not found',
      })
    }

    return reply.code(204).send()
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid chat session id',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to delete chat session',
    })
  }
})

app.post('/chat/completions', async (request, reply) => {
  if (!openaiClient) {
    return reply.code(500).send({
      message: 'OPENAI_API_KEY is not configured on the backend',
    })
  }

  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const body = chatCompletionSchema.parse(request.body)
    const model = resolveGenerationModel(body.model, body.messages)
    const activateWebSearch = Boolean(body.useWebSearch) || shouldUseWebSearch(body.messages)
    const activateLearningMode = Boolean(body.useLearningMode)
    const requestedSessionId = body.chatSessionId
    const userSettingsResult = await pgPool.query<{ chat_history_enabled: boolean }>(
      `
      SELECT chat_history_enabled
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [session.userId],
    )
    const persistChatHistory = userSettingsResult.rows[0]?.chat_history_enabled ?? true

    let chatSessionId = requestedSessionId ?? randomUUID()
    const sessionTitleHint = buildSessionTitle(body.messages)
    let persistedSessionTitle = sessionTitleHint
    let generationId: string = randomUUID()
    let generationStatus: 'queued' | 'in_progress' = 'queued'

    const dbClient = await pgPool.connect()
    try {
      await dbClient.query('BEGIN')

      if (requestedSessionId) {
        const existingSessionResult = await dbClient.query<{ id: string }>(
          `
          SELECT id
          FROM chat_conversations
          WHERE id = $1 AND user_id = $2
          LIMIT 1
          `,
          [requestedSessionId, session.userId],
        )

        if (!existingSessionResult.rows[0]) {
          await dbClient.query('ROLLBACK')
          return reply.code(404).send({
            message: 'Chat session not found',
          })
        }

        chatSessionId = requestedSessionId
      } else {
        await dbClient.query(
          `
          INSERT INTO chat_conversations (id, user_id, title)
          VALUES ($1, $2, $3)
          `,
          [chatSessionId, session.userId, sessionTitleHint],
        )
      }

      const existingGenerationResult = await dbClient.query<{
        id: string
        status: 'queued' | 'in_progress'
      }>(
        `
        SELECT id, status
        FROM chat_generations
        WHERE conversation_id = $1 AND user_id = $2 AND status IN ('queued', 'in_progress')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [chatSessionId, session.userId],
      )

      const existingGeneration = existingGenerationResult.rows[0]
      if (existingGeneration) {
        generationId = existingGeneration.id
        generationStatus = existingGeneration.status
      } else {
        await dbClient.query(
          `
          INSERT INTO chat_generations (
            id,
            conversation_id,
            user_id,
            model,
            use_web_search,
            use_learning_mode,
            input_messages_json,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'queued')
          `,
          [
            generationId,
            chatSessionId,
            session.userId,
            model,
            activateWebSearch,
            activateLearningMode,
            JSON.stringify(body.messages),
          ],
        )
      }

      const updatedSessionResult = await dbClient.query<{ title: string }>(
        `
        UPDATE chat_conversations
        SET
          title = CASE
            WHEN title = 'New chat' THEN $2
            ELSE title
          END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING title
        `,
        [chatSessionId, sessionTitleHint],
      )

      const updatedSession = updatedSessionResult.rows[0]
      if (updatedSession?.title) {
        persistedSessionTitle = updatedSession.title
      }

      await dbClient.query('COMMIT')

      if (generationStatus === 'queued') {
        void runGenerationTask({
          generationId,
          userId: session.userId,
          chatSessionId,
          model,
          activateWebSearch,
          activateLearningMode,
          persistChatHistory,
          messages: body.messages,
        }).catch(async (generationError) => {
          const fallbackMessage =
            generationError instanceof Error && generationError.message
              ? generationError.message
              : 'Unable to complete chat response'

          request.log.error(
            {
              generationId,
              message: fallbackMessage,
              stack: generationError instanceof Error ? generationError.stack : undefined,
            },
            'chat generation failed',
          )

          await markGenerationFailed(generationId, fallbackMessage)
        })
      }
    } catch (dbError) {
      await dbClient.query('ROLLBACK')
      throw dbError
    } finally {
      dbClient.release()
    }

    return reply.send({
      generationId,
      status: generationStatus,
      chatSessionId,
      sessionTitle: persistedSessionTitle,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid chat payload',
        issues: error.issues,
      })
    }

    if (error instanceof Error) {
      request.log.error({ message: error.message, stack: error.stack }, 'chat completion failed')
      return reply.code(500).send({
        message: error.message || 'Unable to complete chat response',
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to complete chat response',
    })
  }
})

app.get('/chat/generations/:generationId', async (request, reply) => {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    const { generationId } = chatGenerationIdParamSchema.parse(request.params)

    const result = await pgPool.query<{
      id: string
      conversation_id: string
      status: 'queued' | 'in_progress' | 'completed' | 'failed'
      response_text: string
      citations_json: unknown
      memory_context_json: unknown
      searched_web: boolean
      thinking_text: string | null
      error_message: string | null
      created_at: string
      updated_at: string
      completed_at: string | null
      session_title: string
    }>(
      `
      SELECT
        g.id,
        g.conversation_id,
        g.status,
        g.response_text,
        g.citations_json,
        g.memory_context_json,
        g.searched_web,
        g.thinking_text,
        g.error_message,
        g.created_at,
        g.updated_at,
        g.completed_at,
        c.title AS session_title
      FROM chat_generations g
      INNER JOIN chat_conversations c ON c.id = g.conversation_id
      WHERE g.id = $1 AND g.user_id = $2
      LIMIT 1
      `,
      [generationId, session.userId],
    )

    const generation = result.rows[0]
    if (!generation) {
      return reply.code(404).send({
        message: 'Generation not found',
      })
    }

    return reply.send({
      generation: {
        id: generation.id,
        chatSessionId: generation.conversation_id,
        sessionTitle: generation.session_title,
        status: generation.status,
        content: generation.response_text,
        citations: Array.isArray(generation.citations_json) ? generation.citations_json : [],
        memoryContext: Array.isArray(generation.memory_context_json) ? generation.memory_context_json : [],
        searchedWeb: Boolean(generation.searched_web),
        ...(typeof generation.thinking_text === 'string' && generation.thinking_text.trim()
          ? { thinking: generation.thinking_text }
          : {}),
        ...(typeof generation.error_message === 'string' && generation.error_message.trim()
          ? { errorMessage: generation.error_message }
          : {}),
        createdAt: generation.created_at,
        updatedAt: generation.updated_at,
        completedAt: generation.completed_at,
      },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        message: 'Invalid generation id',
        issues: error.issues,
      })
    }

    request.log.error(error)
    return reply.code(500).send({
      message: 'Unable to load generation status',
    })
  }
})

async function start() {
  try {
    await Promise.all([checkPostgresConnection(), checkRedisConnection()])
    await initializeDatabase()
    await app.listen({ host: env.HOST, port: env.PORT })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

async function shutdown() {
  await Promise.allSettled([
    app.close(),
    pgPool.end(),
    redisClient.isOpen ? redisClient.quit() : Promise.resolve(),
  ])
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await start()