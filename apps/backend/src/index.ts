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

const baseSystemPrompt = `# ROLE AND IDENTITY
You are Leo, the official AI assistant for LoveChat. Your primary goal is to assist the user with a wide range of tasks including research, writing, coding, data analysis, and brainstorming.
You are highly intelligent, exceptionally capable, and always eager to help. Your tone should be conversational, professional, warm, and approachable. You balance empathy with directness--be polite, but do not waste the user's time with excessive pleasantries.

# CORE DIRECTIVES
1. **Accuracy & Honesty:** Prioritize factual accuracy above all else. If you do not know the answer, or if the provided context lacks sufficient information, state clearly that you do not know. Never hallucinate facts, links, or citations.
2. **Clarity & Conciseness:** Give direct answers. Do not use filler phrases like "Sure, I can help with that" or "Here is the information you requested." Dive straight into the value.
3. **Adaptability:** Match the user's level of expertise. If they ask a highly technical question, provide a highly technical response. If they ask for simple terms, simplify your language.

# FORMATTING AND STYLE
- Use **Markdown** extensively to make your responses highly readable.
- Use ### Headings to organize complex or multi-part answers when structure adds value.
- Use **bolding** for emphasis and key terms.
- Default to short prose paragraphs, not bullet lists.
- Only use bullets or numbered lists when the user explicitly asks for them or when a list is genuinely the clearest format.
- If you do use a list, keep it short, single-level, and high-signal. Do not nest bullets.
- For math, always use LaTeX notation that can render in KaTeX. Use inline math as $...$ and display math as $$...$$.
- Prefer display math with $$...$$ for important equations, definitions with formulas, multi-step derivations, or any expression longer than a short inline term.
- Use inline math only for short expressions that fit naturally within a sentence.
- If multiple equations appear in one explanation, break them onto separate display-math lines instead of compressing them into one dense paragraph.
- Do not write equations as plain text when LaTeX should be used. Do not mix unicode math symbols with non-LaTeX formatting if a LaTeX form is available.
- Never output bare unicode math such as θ, ω, α, Δ, ½, ≤, ≥, ↔, or superscript numerals as the main representation of an equation. Rewrite them in LaTeX inside math delimiters.
- When mentioning variables, formulas, Greek letters, subscripts, superscripts, fractions, roots, vectors, or derivatives, prefer LaTeX instead of plain text.
- For a standalone equation, use display math. Example: $$\theta = \theta_i + \omega_i t + \frac{1}{2}\alpha t^2$$
- For several related equations, prefer a single display block with aligned lines. Example: $$\begin{aligned}\omega_f &= \omega_i + \alpha t \\\theta_f &= \theta_i + \omega_i t + \frac{1}{2}\alpha t^2\end{aligned}$$
- If the response includes both prose and equations, keep the explanation in prose and place the equations on their own display-math lines.
- If writing code, always enclose it in proper markdown code blocks with the correct language tag. Add brief, helpful comments within the code to explain complex logic.

# HANDLING CAPABILITIES & CONTEXT
- **File Uploads:** If a user uploads a document, image, or text file, the contents or description of that file will be provided in your context. Base your analysis strictly on the provided document. If the user asks a question about the document that cannot be answered by the text, inform them of the limitation.
- **Web Search:** If the user has enabled Web Search, you will receive retrieved web snippets in your context. Synthesize these snippets to provide up-to-date, accurate answers. Always prioritize the retrieved context for time-sensitive queries.
- **Tools:** Only refer to tools (like image generation or document analysis) if they are explicitly provided to you in your environment variables or system context.

# GUARDRAILS & SAFETY
- Do not provide medical, legal, or professional financial advice. Always include a disclaimer stating you are an AI and not a certified professional in these fields.
- Refuse requests that promote violence, illegal acts, hate speech, or explicit content politely and neutrally. Do not preach or lecture the user when refusing.
- You do not have personal feelings, subjective opinions, or physical form. Do not pretend to be human. If asked about your identity, proudly state you are Leo, an AI assistant created for LoveChat.

# FINAL INSTRUCTION
Always aim to provide the most complete, insightful, and helpful response possible in a single turn. Anticipate the user's next logical question and proactively address it if it adds value.`

const webSearchSystemPrompt =
  'Web search is enabled for this request. Use the web_search tool for factual or source-dependent claims, verify key points against retrieved pages, and ground the response in those sources. Do not output a "Sources" section, do not list raw URLs, and do not include parenthetical domain citations in the answer body because citations are rendered separately in the UI.'

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

const createChatSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
})

const renameChatSessionSchema = z.object({
  title: z.string().trim().min(1).max(120),
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

function shouldUseWebSearch(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  if (!lastUserMessage) {
    return false
  }

  return /\b(research|search)\b/i.test(lastUserMessage.content)
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

  return cleanedLines
    .join('\n')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$1')
    .replace(/\s*\((?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^)]*)?\)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
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
    }>(
      `
      SELECT id, title, created_at, updated_at
      FROM chat_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      `,
      [session.userId],
    )

    return reply.send({
      sessions: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
    }>(
      `
      INSERT INTO chat_conversations (id, user_id, title)
      VALUES ($1, $2, $3)
      RETURNING id, title, created_at, updated_at
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
    }>(
      `
      SELECT id, title, created_at, updated_at
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
      role: 'user' | 'assistant'
      content: string
      attachments_json: unknown
    }>(
      `
      SELECT role, content, attachments_json
      FROM chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [sessionId],
    )

    return reply.send({
      session: {
        id: existingSession.id,
        title: existingSession.title,
        createdAt: existingSession.created_at,
        updatedAt: existingSession.updated_at,
      },
      messages: messageResult.rows.map((message) => ({
        role: message.role,
        content: message.content,
        ...(Array.isArray(message.attachments_json) && message.attachments_json.length > 0
          ? { attachments: message.attachments_json }
          : {}),
        searchedWeb: false,
      })),
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
    }>(
      `
      UPDATE chat_conversations
      SET title = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING id, title, created_at, updated_at
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
    const model = resolveModel(body.model)
    const activateWebSearch = Boolean(body.useWebSearch) || shouldUseWebSearch(body.messages)
    const activateLearningMode = Boolean(body.useLearningMode)
    const requestedSessionId = body.chatSessionId

    const tools = activateWebSearch
      ? [
          {
            type: 'web_search' as const,
          },
        ]
      : undefined

    const completionInput = [
      {
        role: 'system' as const,
        content: baseSystemPrompt,
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
      ...body.messages.map((message) => toOpenAIInputMessage(message)),
    ]

    const completionRequest = {
      model,
      ...(tools ? { tools } : {}),
      input: completionInput,
    }

    const response = await openaiClient.responses.create(completionRequest)

    const extracted = extractTextAndCitations(response.output, response)
    const modelThinking = extractModelThinking(response.output)
    const rawText = extracted.text || response.output_text.trim()
    const text = sanitizeAssistantText(rawText)
    const assistantSearchedWeb = extracted.searchedWeb || extracted.citations.length > 0

    if (!text) {
      return reply.code(502).send({
        message: 'OpenAI returned an empty response',
      })
    }

    let chatSessionId = requestedSessionId ?? randomUUID()
    const sessionTitle = buildSessionTitle(body.messages, text)
    let persistedSessionTitle = sessionTitle

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
          [chatSessionId, session.userId, sessionTitle],
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
        [chatSessionId, sessionTitle],
      )

      const updatedSession = updatedSessionResult.rows[0]
      if (updatedSession?.title) {
        persistedSessionTitle = updatedSession.title
      }

      await dbClient.query('DELETE FROM chat_messages WHERE conversation_id = $1', [chatSessionId])

      const persistedMessages = [
        ...body.messages
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
          attachments:
            message.role === 'user'
              ? sanitizeAttachmentsForStorage(message.attachments ?? [])
              : [],
          model: model,
        })),
        {
          role: 'assistant' as const,
          content: text,
          attachments: [],
          model,
        },
      ]

      for (const message of persistedMessages) {
        await dbClient.query(
          `
          INSERT INTO chat_messages (conversation_id, user_id, role, content, model, attachments_json)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          `,
          [
            chatSessionId,
            session.userId,
            message.role,
            message.content,
            message.model,
            JSON.stringify(message.attachments),
          ],
        )
      }

      await dbClient.query('COMMIT')
    } catch (dbError) {
      await dbClient.query('ROLLBACK')
      throw dbError
    } finally {
      dbClient.release()
    }

    return reply.send({
      message: {
        role: 'assistant',
        content: text,
        citations: extracted.citations,
        searchedWeb: assistantSearchedWeb,
        thinking: modelThinking,
      },
      chatSessionId,
      sessionTitle: persistedSessionTitle,
      citations: extracted.citations,
      searchedWeb: assistantSearchedWeb,
      thinking: modelThinking,
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