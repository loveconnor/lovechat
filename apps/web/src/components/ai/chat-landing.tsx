import { useNavigate } from '@tanstack/react-router'
import {
  BookMarked,
  Check,
  ChevronDown,
  Copy,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  GitBranch,
  Pencil,
  RotateCcw,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CitationList } from '#/components/ai/citation'
import { CanvasCodeBlock, CanvasPreviewPanel, defaultCanvasCode } from '#/components/ai/chat-canvas'
import { ChatHeader } from '#/components/ai/chat-header'
import { ChatInput } from '#/components/ai/chat-input'
import { ChatSidebar } from '#/components/ai/chat-sidebar'
import { Markdown } from '#/components/ai/markdown'
import { SettingsDialog } from '#/components/ai/settings-dialog'
import { ChartCard } from '#/components/ai/visualization/chart-card'
import { parseVisualizationContent } from '#/components/ai/visualization/parse'
import AIThinking from '#/components/ai/thinking'
import { safeParseSerializableCitation } from '#/components/ai/citation/schema'
import { useStream } from '#/components/ai/use-stream'
import type { SerializableCitation } from '#/components/ai/citation'
import type { ChartAction } from '#/components/ai/visualization/schema'

type Topic = 'Research' | 'Create Images' | 'How to' | 'Analyze' | 'Code'
type ChatRole = 'user' | 'assistant'

type ChatAttachment = {
  id: string
  name: string
  mimeType: string
  size: number
  textContent?: string
  imageDataUrl?: string
}

type MemoryCategory = 'identity' | 'preferences' | 'goals' | 'constraints'
type MemoryUsageReason = 'identity' | 'style_preference' | 'goal_alignment' | 'constraint_guardrail'

type UsedMemoryContext = {
  id: string
  content: string
  category: MemoryCategory
  reason: MemoryUsageReason
  score?: number
}

type FollowUpSuggestion = {
  id: string
  label: string
  prompt: string
}

type CanvasContext = {
  question: string
}

type ChatMessage = {
  id: string
  messageId?: number
  role: ChatRole
  content: string
  attachments?: ChatAttachment[]
  canvasContext?: CanvasContext
  citations?: SerializableCitation[]
  memoryContext?: UsedMemoryContext[]
  searchedWeb?: boolean
}

type ForkIntent = 'alternative' | 'tone' | 'research' | 'debug' | 'custom'

type BranchNodeDialogState = {
  messageId: string
  messageDbId: number
  messageIndex: number
}

type CompareDialogState = {
  branchSessionId: string
  forkIndex: number
}

type OnboardingProfileResponse = {
  profile: {
    fullName: string
    nickname: string
  }
}

type AccountProfileResponse = {
  profile: {
    email: string
    fullName: string
    nickname: string
    avatarDataUrl: string | null
  }
}

type ChatCompletionResponse = {
  generationId: string
  status: 'queued' | 'in_progress'
  chatSessionId?: string
  sessionTitle?: string
}

type ChatGenerationPayload = {
  id: string
  chatSessionId: string
  sessionTitle?: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  content: string
  followUps?: unknown
  citations?: unknown
  memoryContext?: unknown
  searchedWeb?: boolean
  thinking?: string
  errorMessage?: string
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

type ChatGenerationResponse = {
  generation: ChatGenerationPayload
}

type ChatSessionSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  parentSessionId?: string | null
  forkedFromMessageId?: number | null
  branchDepth?: number
  generationStatus?: 'queued' | 'in_progress' | null
}

type ChatSessionsResponse = {
  sessions: ChatSessionSummary[]
}

type ForkChatSessionResponse = {
  session: ChatSessionSummary
}

type ChatSessionResponse = {
  session: ChatSessionSummary
  messages: Array<{
    messageId?: number
    role: ChatRole
    content: string
    attachments?: unknown
    canvasContext?: unknown
    citations?: unknown
    memoryContext?: unknown
    searchedWeb?: boolean
    thinking?: string
  }>
  activeGeneration?: {
    id: string
    status: 'queued' | 'in_progress'
    content: string
    followUps?: unknown
    citations?: unknown
    memoryContext?: unknown
    searchedWeb?: boolean
    thinking?: string
    errorMessage?: string
    createdAt: string
    updatedAt: string
    completedAt?: string | null
  }
}

type SubmitPromptOptions = {
  silent?: boolean
}

type RequestAssistantReplyOptions = {
  canvasQuestion?: string
  reuseAssistantMessageId?: string
}

type ExtractedCanvasStreamParts = {
  code: string
  language: string
  markdownWithoutCode: string
}

type CanvasPreviewPayload = {
  question: string
  code: string
}

type CanvasVersionHistoryItem = CanvasPreviewPayload & {
  id: string
  label: string
}

type CanvasGenerationBaseline = CanvasPreviewPayload & {
  language: string
}

function extractCanvasStreamParts(content: string): ExtractedCanvasStreamParts {
  const openMatch = /```([^\r\n`]*)[\r\n]/.exec(content)
  if (!openMatch || openMatch.index === undefined) {
    return {
      code: '',
      language: '',
      markdownWithoutCode: content,
    }
  }

  const fenceStart = openMatch.index
  const codeStart = fenceStart + openMatch[0].length
  const closeIndex = content.indexOf('```', codeStart)
  const language = openMatch[1]?.trim().toLowerCase() ?? ''

  if (closeIndex === -1) {
    return {
      code: content.slice(codeStart).trim(),
      language,
      markdownWithoutCode: content.slice(0, fenceStart).trim(),
    }
  }

  return {
    code: content.slice(codeStart, closeIndex).trim(),
    language,
    markdownWithoutCode: `${content.slice(0, fenceStart)}${content.slice(closeIndex + 3)}`.trim(),
  }
}

function buildCanvasResponseContent(markdown: string, code: string, language?: string) {
  const normalizedMarkdown = markdown.trim()
  const normalizedLanguage = language?.trim() || 'html'
  const fencedCode = `\`\`\`${normalizedLanguage}\n${code}\n\`\`\``

  return normalizedMarkdown ? `${normalizedMarkdown}\n\n${fencedCode}` : fencedCode
}

function preserveCanvasResponseContent(content: string, fallback?: CanvasGenerationBaseline | null) {
  if (!fallback?.code) {
    return content
  }

  const parsed = extractCanvasStreamParts(stripAssistantImageMarkdown(content))
  if (parsed.code) {
    return content
  }

  return buildCanvasResponseContent(parsed.markdownWithoutCode, fallback.code, fallback.language)
}

function getCanvasBaselineFromMessage(message: ChatMessage | null | undefined): CanvasGenerationBaseline | null {
  if (!message || message.role !== 'assistant' || !message.canvasContext?.question) {
    return null
  }

  const parsed = extractCanvasStreamParts(stripAssistantImageMarkdown(message.content))
  if (!parsed.code) {
    return null
  }

  return {
    question: message.canvasContext.question,
    code: parsed.code,
    language: parsed.language || 'html',
  }
}

function buildCanvasPreviewPayload(
  content: string,
  question: string,
  fallback?: CanvasGenerationBaseline | null,
): CanvasPreviewPayload {
  const parsed = extractCanvasStreamParts(stripAssistantImageMarkdown(content))
  if (parsed.code) {
    return {
      question,
      code: parsed.code,
    }
  }

  if (fallback?.code) {
    return {
      question,
      code: fallback.code,
    }
  }

  return {
    question,
    code: defaultCanvasCode,
  }
}

function convertCodeBlockToCanvasCode(code: string, language: string) {
  const normalizedLanguage = language.trim().toLowerCase()
  const trimmedCode = code.trim()

  if (!trimmedCode) {
    return defaultCanvasCode
  }

  if (normalizedLanguage === 'html') {
    return trimmedCode
  }

  if (normalizedLanguage === 'css') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Canvas from CSS</title>
  <style>
${trimmedCode}
  </style>
</head>
<body>
  <main class="canvas-code-preview">
    <h1>Canvas from CSS</h1>
    <p>This code block only included styles, so this canvas preserves the CSS in a preview wrapper.</p>
    <section class="card">Add matching HTML structure or keep iterating from here.</section>
  </main>
</body>
</html>`
  }

  if (normalizedLanguage === 'js' || normalizedLanguage === 'ts' || normalizedLanguage === 'tsx') {
    // Keep JS/TS/TSX as source so preview can render with local runtime.
    return trimmedCode
  }

  if (normalizedLanguage === 'json') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Canvas from JSON</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; }
    main { max-width: 960px; margin: 0 auto; padding: 48px 24px; }
    pre { overflow: auto; border-radius: 16px; background: #0f172a; color: #e2e8f0; padding: 20px; }
  </style>
</head>
<body>
  <main>
    <h1>Canvas from JSON</h1>
    <pre>${escapeHtml(trimmedCode)}</pre>
  </main>
</body>
</html>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Canvas from ${normalizedLanguage || 'code'}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; }
    main { max-width: 960px; margin: 0 auto; padding: 48px 24px; }
    pre { overflow: auto; border-radius: 16px; background: #0f172a; color: #e2e8f0; padding: 20px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <main>
    <h1>Canvas from ${normalizedLanguage || 'code'}</h1>
    <pre>${escapeHtml(trimmedCode)}</pre>
  </main>
</body>
</html>`
}

type LandingGreeting = {
  headerTemplate: string
  subtext: string
}

type TimedGreeting = LandingGreeting & {
  isEligible: (now: Date) => boolean
}

const webSearchKeywordPattern = /\b(research|search)\b/i
const imageGenerationKeywordPattern =
  /(make|generate|create|draw|design)\s+(?:me\s+)?(?:(?:an?|some)\s+)?(?:image|images|picture|pictures|photo|photos|illustration|illustrations|artwork|artworks)\b/i
const assistantRequestTimeoutMs = 45_000
const defaultThinkingText = 'LoveChat is thinking...'
const thinkingRevealDelayMs = 1200
const manualMemoryContentLimit = 2_000
const mobileLayoutMediaQuery = '(max-width: 767px)'
const attachmentTextContentLimit = 20_000
const attachmentImageDataUrlLimit = 6_000_000
const attachmentPreviewDataUrlLimit = 8_000_000
const selectedModelStorageKey = 'lovechat_selected_model_v1'
const defaultSelectedModel = 'gpt-5'
const previewPanelMinWidthPx = 360
const chatPanelMinWidthPx = 320
const quickTemplatesMinPaneWidthPx = 760
const headerTitleMinPaneWidthPx = 840
const headerTitleWithBranchMapMinPaneWidthPx = 940
const greetingNameToken = '{name}'
const forkIntentLabels: Record<ForkIntent, string> = {
  alternative: 'Alternative solution',
  tone: 'Different tone',
  research: 'Research path',
  debug: 'Debug path',
  custom: 'Custom',
}
const assistantImageMarkdownRegex =
  /!\[[^\]]*\]\((?:<(data:image\/[^>]+|https?:\/\/[^>]+)>|(data:image\/[^)\s]+|https?:\/\/[^)\s]+))\)/gi
const assistantImageDataUrlRegex = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi
const assistantImageHttpUrlRegex = /https?:\/\/[^\s)>'"]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s)>'"]*)?/gi

const suggestionsData: Record<Topic, string[]> = {
  Research: [
    'Research the latest breakthroughs in quantum computing.',
    'Research the history of ancient Roman architecture.',
    'Research the economic impact of renewable energy.',
    'Research the psychological effects of social media.',
    'Research the best practices for remote team collaboration.',
  ],
  'Create Images': [
    'Create images of a futuristic cyberpunk cityscape.',
    'Create images of a peaceful mountain landscape at sunset.',
    'Create images of a cute robot drinking a cup of coffee.',
    'Create images of a minimalist geometric logo design.',
    'Create images of an abstract painting in cool blue tones.',
  ],
  'How to': [
    'How to bake a perfect sourdough bread from scratch.',
    'How to write an effective and professional resume.',
    'How to start a thriving indoor vegetable garden.',
    'How to learn Python programming as a beginner.',
    'How to negotiate a salary offer successfully.',
  ],
  Analyze: [
    'Analyze the sentiment of the following customer reviews.',
    'Analyze this dataset for underlying seasonal trends.',
    'Analyze the quarterly financial report for key takeaways.',
    'Analyze the performance metrics of the recent marketing campaign.',
    "Analyze the competitor's pricing strategy in the market.",
  ],
  Code: [
    'Code a simple responsive navigation bar using Tailwind.',
    'Code a Python script to scrape data from a website.',
    'Code a RESTful API endpoint using Node.js and Express.',
    'Code a React component for a customizable to-do list.',
    'Code a SQL query to find the top 5 highest-paying customers.',
  ],
}

const baseLandingGreetings: LandingGreeting[] = [
  { headerTemplate: 'Workspace loaded and ready, {name}.', subtext: 'What are we engineering today?' },
  { headerTemplate: 'Blank canvas, {name}.', subtext: "What's the next big idea?" },
  { headerTemplate: 'All systems go, {name}.', subtext: "Let's build something awesome." },
  { headerTemplate: 'Focus mode engaged, {name}.', subtext: 'What are we solving first?' },
  { headerTemplate: 'Welcome back, {name}.', subtext: 'Where did we leave off?' },
  { headerTemplate: 'Hey, {name}.', subtext: "What's the move today?" },
  { headerTemplate: 'Good to see you, {name}.', subtext: 'How can I help right now?' },
  { headerTemplate: 'Ready when you are, {name}.', subtext: 'Type away.' },
  { headerTemplate: "I'm fully charged, {name}.", subtext: "Let's make some magic happen." },
  { headerTemplate: 'Greetings, {name}.', subtext: 'Test me with a hard prompt.' },
  { headerTemplate: 'Standing by, {name}.', subtext: 'Give me a challenge.' },
  { headerTemplate: 'Brain synapses firing, {name}?', subtext: 'Throw your toughest problem at me.' },
  { headerTemplate: 'Ready for a challenge, {name}?', subtext: "Let's solve today's puzzle." },
]

const timedLandingGreetings: TimedGreeting[] = [
  {
    headerTemplate: 'Burning the midnight oil, {name}?',
    subtext: "I'm awake if you are. Let's get to work.",
    isEligible: (now) => now.getHours() >= 22 || now.getHours() < 5,
  },
  {
    headerTemplate: 'Early bird gets the worm, {name}.',
    subtext: "Coffee in hand? Let's tackle the day.",
    isEligible: (now) => now.getHours() >= 5 && now.getHours() < 11,
  },
  {
    headerTemplate: 'Afternoon momentum, {name}.',
    subtext: 'What are we shipping today?',
    isEligible: (now) => now.getHours() >= 11 && now.getHours() < 17,
  },
  {
    headerTemplate: 'Evening sprint, {name}.',
    subtext: 'What should we wrap up tonight?',
    isEligible: (now) => now.getHours() >= 17 && now.getHours() < 22,
  },
  {
    headerTemplate: 'Happy Friday, {name}.',
    subtext: "Let's wrap things up strong.",
    isEligible: (now) => now.getDay() === 5,
  },
  {
    headerTemplate: 'Mid-week momentum, {name}.',
    subtext: 'What are we pushing over the line?',
    isEligible: (now) => {
      const day = now.getDay()
      return day === 3 || day === 4
    },
  },
]

const initialLandingGreeting: LandingGreeting = baseLandingGreetings[0]

function chooseRandom<T>(items: readonly T[]) {
  const index = Math.floor(Math.random() * items.length)
  return items[index]
}

function pickLandingGreeting(previous?: LandingGreeting): LandingGreeting {
  const now = new Date()
  const contextualGreetings = timedLandingGreetings
    .filter((entry) => entry.isEligible(now))
    .map(({ headerTemplate, subtext }) => ({ headerTemplate, subtext }))
  const availableGreetings = [...baseLandingGreetings, ...contextualGreetings]

  let nextGreeting = chooseRandom(availableGreetings)

  if (previous && availableGreetings.length > 1) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (
        nextGreeting.headerTemplate !== previous.headerTemplate ||
        nextGreeting.subtext !== previous.subtext
      ) {
        break
      }

      nextGreeting = chooseRandom(availableGreetings)
    }
  }

  return nextGreeting
}

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return 'LC'
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

function getFirstName(fullName: string, nickname: string) {
  const trimmedNickname = nickname.trim()
  if (trimmedNickname) {
    return trimmedNickname
  }

  const firstName = fullName.trim().split(/\s+/)[0]
  return firstName || 'Friend'
}

function normalizeCitations(input: unknown): SerializableCitation[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((citation) => safeParseSerializableCitation(citation))
    .filter((citation): citation is SerializableCitation => citation !== null)
}

function normalizeMemoryContext(input: unknown): UsedMemoryContext[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as {
        id?: unknown
        content?: unknown
        category?: unknown
        reason?: unknown
        score?: unknown
      }

      const id = typeof candidate.id === 'string' ? candidate.id : ''
      const content = typeof candidate.content === 'string' ? candidate.content.trim() : ''
      const category =
        candidate.category === 'identity' ||
        candidate.category === 'preferences' ||
        candidate.category === 'goals' ||
        candidate.category === 'constraints'
          ? candidate.category
          : null
      const reason =
        candidate.reason === 'identity' ||
        candidate.reason === 'style_preference' ||
        candidate.reason === 'goal_alignment' ||
        candidate.reason === 'constraint_guardrail'
          ? candidate.reason
          : null

      if (!id || !content || !category || !reason) {
        return null
      }

      return {
        id,
        content,
        category,
        reason,
        ...(typeof candidate.score === 'number' && Number.isFinite(candidate.score)
          ? { score: candidate.score }
          : {}),
      }
    })
    .filter((item): item is UsedMemoryContext => item !== null)
}

function normalizeFollowUps(input: unknown): FollowUpSuggestion[] {
  if (!Array.isArray(input)) {
    return []
  }

  const dedupeSet = new Set<string>()

  return input
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as { id?: unknown; label?: unknown; prompt?: unknown }
      const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
      const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : ''
      if (!label || !prompt) {
        return null
      }

      const rawId = typeof candidate.id === 'string' ? candidate.id.trim() : ''
      const id = rawId || `follow-up-${index + 1}`
      const dedupeKey = `${label.toLowerCase()}::${prompt.toLowerCase()}`
      if (dedupeSet.has(dedupeKey)) {
        return null
      }

      dedupeSet.add(dedupeKey)
      return { id, label, prompt }
    })
    .filter((item): item is FollowUpSuggestion => item !== null)
    .slice(0, 4)
}

function normalizeAttachments(input: unknown): ChatAttachment[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as {
        id?: unknown
        name?: unknown
        mimeType?: unknown
        size?: unknown
        textContent?: unknown
        imageDataUrl?: unknown
      }

      const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
      const mimeType = typeof candidate.mimeType === 'string' ? candidate.mimeType.trim() : ''
      const size = typeof candidate.size === 'number' && Number.isFinite(candidate.size) ? candidate.size : Number.NaN

      if (!name || !mimeType || !Number.isFinite(size) || size < 0) {
        return null
      }

      const textContent =
        typeof candidate.textContent === 'string' && candidate.textContent.trim()
          ? candidate.textContent
          : undefined

      const imageDataUrl =
        typeof candidate.imageDataUrl === 'string' && candidate.imageDataUrl.startsWith('data:image/')
          ? candidate.imageDataUrl
          : undefined

      const id =
        typeof candidate.id === 'string' && candidate.id.trim()
          ? candidate.id
          : `attachment-${Date.now()}-${index}`

      return {
        id,
        name,
        mimeType,
        size,
        ...(textContent ? { textContent } : {}),
        ...(imageDataUrl ? { imageDataUrl } : {}),
      }
    })
    .filter((attachment): attachment is ChatAttachment => attachment !== null)
}

function normalizeCanvasContext(input: unknown): CanvasContext | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const questionCandidate = (input as { question?: unknown }).question
  const question = typeof questionCandidate === 'string' ? questionCandidate.trim() : ''
  if (!question) {
    return null
  }

  return {
    question,
  }
}

function formatFileSize(size: number) {
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

function getAttachmentTypeLabel(attachment: ChatAttachment) {
  if (attachment.mimeType === 'application/pdf') {
    return 'PDF Document'
  }

  if (
    attachment.mimeType.includes('msword') ||
    attachment.mimeType.includes('wordprocessingml') ||
    attachment.name.toLowerCase().endsWith('.doc') ||
    attachment.name.toLowerCase().endsWith('.docx')
  ) {
    return 'Word Document'
  }

  if (attachment.mimeType.startsWith('image/')) {
    return 'Image'
  }

  if (attachment.mimeType.startsWith('text/')) {
    return 'Text Document'
  }

  return 'File'
}

function getAttachmentExtension(fileName: string) {
  const segments = fileName.toLowerCase().split('.')
  return segments.length > 1 ? segments.pop() ?? '' : ''
}

type AttachmentVisual = {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>
  iconClassName: string
  containerClassName: string
}

function getAttachmentVisual(attachment: ChatAttachment): AttachmentVisual {
  const mimeType = attachment.mimeType.toLowerCase()
  const extension = getAttachmentExtension(attachment.name)

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return {
      Icon: FileText,
      iconClassName: 'text-red-500 dark:text-red-300',
      containerClassName: 'bg-red-50 dark:bg-red-500/15',
    }
  }

  if (
    mimeType.includes('msword') ||
    mimeType.includes('wordprocessingml') ||
    extension === 'doc' ||
    extension === 'docx'
  ) {
    return {
      Icon: FileText,
      iconClassName: 'text-blue-600 dark:text-blue-300',
      containerClassName: 'bg-blue-50 dark:bg-blue-500/15',
    }
  }

  if (
    mimeType.startsWith('text/html') ||
    extension === 'html' ||
    extension === 'htm' ||
    extension === 'xml' ||
    extension === 'css' ||
    extension === 'js' ||
    extension === 'ts' ||
    extension === 'tsx' ||
    extension === 'jsx' ||
    extension === 'json' ||
    extension === 'md'
  ) {
    return {
      Icon: FileCode2,
      iconClassName: 'text-blue-500 dark:text-blue-300',
      containerClassName: 'bg-blue-50 dark:bg-blue-500/15',
    }
  }

  if (mimeType.startsWith('image/')) {
    return {
      Icon: FileImage,
      iconClassName: 'text-emerald-500 dark:text-emerald-300',
      containerClassName: 'bg-emerald-50 dark:bg-emerald-500/15',
    }
  }

  if (mimeType.startsWith('audio/')) {
    return {
      Icon: FileAudio,
      iconClassName: 'text-fuchsia-500 dark:text-fuchsia-300',
      containerClassName: 'bg-fuchsia-50 dark:bg-fuchsia-500/15',
    }
  }

  if (mimeType.startsWith('video/')) {
    return {
      Icon: FileVideo,
      iconClassName: 'text-violet-500 dark:text-violet-300',
      containerClassName: 'bg-violet-50 dark:bg-violet-500/15',
    }
  }

  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    extension === 'csv' ||
    extension === 'xls' ||
    extension === 'xlsx'
  ) {
    return {
      Icon: FileSpreadsheet,
      iconClassName: 'text-green-600 dark:text-green-300',
      containerClassName: 'bg-green-50 dark:bg-green-500/15',
    }
  }

  if (
    mimeType.includes('zip') ||
    mimeType.includes('compressed') ||
    extension === 'zip' ||
    extension === 'rar' ||
    extension === '7z' ||
    extension === 'tar' ||
    extension === 'gz'
  ) {
    return {
      Icon: FileArchive,
      iconClassName: 'text-amber-500 dark:text-amber-300',
      containerClassName: 'bg-amber-50 dark:bg-amber-500/15',
    }
  }

  return {
    Icon: FileText,
    iconClassName: 'text-gray-500 dark:text-gray-300',
    containerClassName: 'bg-gray-100 dark:bg-white/10',
  }
}

function slugifyFilename(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getAssistantRenderableContent(content: string) {
  return parseVisualizationContent(content)
}

function extractAssistantImageUrls(content: string) {
  const urls: string[] = []
  const seen = new Set<string>()

  for (const match of content.matchAll(assistantImageMarkdownRegex)) {
    const url = (match[1] || match[2] || '').trim()
    if (!url || seen.has(url)) {
      continue
    }

    seen.add(url)
    urls.push(url)
  }

  for (const match of content.matchAll(assistantImageDataUrlRegex)) {
    const url = match[0].trim()
    if (!url || seen.has(url)) {
      continue
    }

    seen.add(url)
    urls.push(url)
  }

  for (const match of content.matchAll(assistantImageHttpUrlRegex)) {
    const url = match[0].trim()
    if (!url || seen.has(url)) {
      continue
    }

    seen.add(url)
    urls.push(url)
  }

  return urls
}

function shouldCacheAttachmentPreview(file: File) {
  const mimeType = file.type.toLowerCase()
  const lowerName = file.name.toLowerCase()

  if (mimeType === 'application/pdf') {
    return true
  }

  if (mimeType.startsWith('text/')) {
    return true
  }

  if (mimeType.includes('html') || lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    return true
  }

  return false
}

function stripAssistantImageMarkdown(content: string) {
  return content
    .replace(assistantImageMarkdownRegex, '')
    .replace(assistantImageDataUrlRegex, '')
    .replace(assistantImageHttpUrlRegex, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function inferImageExtensionFromUrl(url: string) {
  if (url.startsWith('data:image/')) {
    const mimeMatch = url.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/i)
    const raw = mimeMatch?.[1]?.toLowerCase() ?? 'png'
    return raw === 'jpeg' ? 'jpg' : raw
  }

  const path = url.split('?')[0]
  const extMatch = path.match(/\.([a-zA-Z0-9]+)$/)
  const ext = extMatch?.[1]?.toLowerCase()
  if (!ext) {
    return 'png'
  }

  return ext === 'jpeg' ? 'jpg' : ext
}

function triggerBrowserDownload(href: string, fileName: string) {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = fileName
  anchor.rel = 'noopener noreferrer'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

async function downloadAssistantImage(url: string) {
  const extension = inferImageExtensionFromUrl(url)
  const fileName = `lovechat-image-${Date.now()}.${extension}`

  if (url.startsWith('data:image/')) {
    triggerBrowserDownload(url, fileName)
    return
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Unable to fetch image for download')
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerBrowserDownload(objectUrl, fileName)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
    return
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

async function copyAssistantImageToClipboard(url: string) {
  if (typeof ClipboardItem === 'undefined') {
    throw new Error('Image clipboard is not supported in this browser')
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Unable to fetch image for clipboard')
  }

  const blob = await response.blob()
  const imageType = blob.type.startsWith('image/') ? blob.type : 'image/png'
  const clipboardItem = new ClipboardItem({
    [imageType]: blob,
  })

  await navigator.clipboard.write([clipboardItem])
}

function getAssistantCopyContent(content: string) {
  const parsed = getAssistantRenderableContent(content)
  return parsed.markdown.trim()
}

function normalizeMemoryContent(content: string, maxLength = manualMemoryContentLimit) {
  const collapsed = content.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= maxLength) {
    return collapsed
  }

  const slice = collapsed.slice(0, maxLength)
  const sentenceBoundary = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '))
  if (sentenceBoundary >= 32) {
    return slice.slice(0, sentenceBoundary + 1).trim()
  }

  return slice.trim()
}

function getAssistantExportContent(content: string) {
  const parsed = getAssistantRenderableContent(content)
  const chartSummaries = parsed.charts.map((chart) => `Chart: ${chart.title} (${chart.chartType})`)

  return [parsed.markdown.trim(), ...chartSummaries].filter(Boolean).join('\n\n').trim()
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to encode file'))
    }

    reader.readAsDataURL(file)
  })
}

async function extractPdfText(file: File) {
  try {
    const [pdfjs, pdfWorkerModule] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])

    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerModule.default
    }

    const fileBuffer = await file.arrayBuffer()
    let document: {
      numPages: number
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{
          items: Array<{ str?: string }>
        }>
      }>
    }

    try {
      const loadingTask = pdfjs.getDocument({ data: fileBuffer })
      document = (await loadingTask.promise) as unknown as typeof document
    } catch {
      // Fallback for environments where worker setup fails unexpectedly.
      const loadingTask = pdfjs.getDocument({
        data: fileBuffer,
        disableWorker: true,
      } as unknown as Parameters<typeof pdfjs.getDocument>[0])
      document = (await loadingTask.promise) as unknown as typeof document
    }

    const pageCount = Math.min(document.numPages, 20)
    let combinedText = ''

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (!pageText) {
        continue
      }

      combinedText += `\n\n[Page ${pageNumber}]\n${pageText}`
      if (combinedText.length >= attachmentTextContentLimit) {
        break
      }
    }

    const normalized = combinedText.trim().slice(0, attachmentTextContentLimit)
    return normalized || undefined
  } catch {
    return undefined
  }
}

async function parseUploadedFiles(files: File[]): Promise<ChatAttachment[]> {
  const parsed = await Promise.all(
    files.map(async (file, index) => {
      const fallbackName = file.type.startsWith('image/') ? `image-${index + 1}.png` : `file-${index + 1}`
      const baseAttachment: ChatAttachment = {
        id: `attachment-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name.trim() || fallbackName,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }

      if (file.type.startsWith('text/')) {
        try {
          const textContent = (await file.text()).slice(0, attachmentTextContentLimit)
          if (textContent.trim()) {
            return {
              ...baseAttachment,
              textContent,
            }
          }
        } catch {
          return baseAttachment
        }
      }

      if (file.type === 'application/pdf') {
        const textContent = await extractPdfText(file)
        if (textContent) {
          return {
            ...baseAttachment,
            textContent,
          }
        }
      }

      if (file.type.startsWith('image/')) {
        try {
          const imageDataUrl = await fileToDataUrl(file)
          if (imageDataUrl.length <= attachmentImageDataUrlLimit) {
            return {
              ...baseAttachment,
              imageDataUrl,
            }
          }
        } catch {
          return baseAttachment
        }
      }

      return baseAttachment
    }),
  )

  return parsed
}

function createMessage(
  role: ChatRole,
  content: string,
  metadata?: {
    messageId?: number
    attachments?: ChatAttachment[]
    canvasContext?: CanvasContext
    citations?: SerializableCitation[]
    memoryContext?: UsedMemoryContext[]
    searchedWeb?: boolean
  },
): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...(metadata?.messageId !== undefined ? { messageId: metadata.messageId } : {}),
    role,
    content,
    ...(metadata?.attachments ? { attachments: metadata.attachments } : {}),
    ...(metadata?.canvasContext ? { canvasContext: metadata.canvasContext } : {}),
    ...(metadata?.citations ? { citations: metadata.citations } : {}),
    ...(metadata?.memoryContext ? { memoryContext: metadata.memoryContext } : {}),
    ...(metadata?.searchedWeb !== undefined ? { searchedWeb: metadata.searchedWeb } : {}),
  }
}

function toSessionDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function getSessionBucketLabel(updatedAt: string) {
  const date = toSessionDate(updatedAt)
  if (!date) {
    return 'Older'
  }

  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysDiff = Math.floor((startToday.getTime() - startDate.getTime()) / 86_400_000)

  if (daysDiff <= 0) {
    return 'Today'
  }

  if (daysDiff <= 7) {
    return 'Previous 7 Days'
  }

  return 'Older'
}

function mapSessionsWithBranchDepth(sessions: ChatSessionSummary[]) {
  const sessionById = new Map<string, ChatSessionSummary>()
  for (const session of sessions) {
    sessionById.set(session.id, session)
  }

  const depthMemo = new Map<string, number>()

  const resolveDepth = (sessionId: string, visited = new Set<string>()): number => {
    if (depthMemo.has(sessionId)) {
      return depthMemo.get(sessionId) ?? 0
    }

    const session = sessionById.get(sessionId)
    const parentId = session?.parentSessionId ?? null
    if (!parentId || !sessionById.has(parentId) || visited.has(parentId)) {
      depthMemo.set(sessionId, 0)
      return 0
    }

    const nextVisited = new Set(visited)
    nextVisited.add(sessionId)
    const depth = resolveDepth(parentId, nextVisited) + 1
    depthMemo.set(sessionId, depth)
    return depth
  }

  return sessions.map((session) => ({
    ...session,
    branchDepth: resolveDepth(session.id),
  }))
}

function buildForkTitle(intent: ForkIntent, customTitle: string, baseTitle: string) {
  const trimmed = customTitle.trim()
  if (trimmed) {
    return trimmed
  }

  if (intent === 'custom') {
    return `Fork: ${baseTitle}`
  }

  return `${forkIntentLabels[intent]}: ${baseTitle}`
}

function loadSelectedModelPreference() {
  if (typeof window === 'undefined') {
    return defaultSelectedModel
  }

  try {
    const stored = window.localStorage.getItem(selectedModelStorageKey)?.trim()
    return stored ? stored : defaultSelectedModel
  } catch {
    return defaultSelectedModel
  }
}

function ChatLanding() {
  const navigate = useNavigate()
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL ?? 'http://localhost:4000', [])
  const [selectedModel, setSelectedModel] = useState(defaultSelectedModel)
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null)
  const [isMobileLayout, setIsMobileLayout] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isSessionsLoading, setIsSessionsLoading] = useState(true)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [renameDialogDraft, setRenameDialogDraft] = useState('')
  const [isRenameSaving, setIsRenameSaving] = useState(false)
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [activeAttachmentPreview, setActiveAttachmentPreview] = useState<ChatAttachment | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [sessionIdPendingDelete, setSessionIdPendingDelete] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [aiFollowUps, setAiFollowUps] = useState<FollowUpSuggestion[]>([])
  const [webSearchActive, setWebSearchActive] = useState(false)
  const [learningModeActive, setLearningModeActive] = useState(false)
  const [isCanvasModeEnabled, setIsCanvasModeEnabled] = useState(false)
  const [queuedCanvasQuestion, setQueuedCanvasQuestion] = useState<string | null>(null)
  const [activeCanvasContext, setActiveCanvasContext] = useState<{ messageId: string; question: string } | null>(null)
  const [canvasPreviewPayload, setCanvasPreviewPayload] = useState<CanvasPreviewPayload | null>(null)
  const [isCanvasPreviewOpen, setIsCanvasPreviewOpen] = useState(false)
  const [isCanvasPreviewUpdating, setIsCanvasPreviewUpdating] = useState(false)
  const [previewPanelWidth, setPreviewPanelWidth] = useState<number | null>(null)
  const [isPreviewResizeActive, setIsPreviewResizeActive] = useState(false)
  const [chatPaneWidth, setChatPaneWidth] = useState<number | null>(null)
  const [thinkingText, setThinkingText] = useState(defaultThinkingText)
  const [showThinking, setShowThinking] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [landingGreeting, setLandingGreeting] = useState<LandingGreeting>(initialLandingGreeting)
  const [showAllMobileSuggestions, setShowAllMobileSuggestions] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [recentlyRememberedMessageId, setRecentlyRememberedMessageId] = useState<string | null>(null)
  const [isForkDialogOpen, setIsForkDialogOpen] = useState(false)
  const [forkTargetMessageId, setForkTargetMessageId] = useState<string | null>(null)
  const [forkIntent, setForkIntent] = useState<ForkIntent>('alternative')
  const [forkTitleDraft, setForkTitleDraft] = useState('')
  const [isForkSaving, setIsForkSaving] = useState(false)
  const [isBranchMapOpen, setIsBranchMapOpen] = useState(false)
  const [branchNodeDialog, setBranchNodeDialog] = useState<BranchNodeDialogState | null>(null)
  const [compareDialog, setCompareDialog] = useState<CompareDialogState | null>(null)
  const [branchComparePayloadBySessionId, setBranchComparePayloadBySessionId] =
    useState<Record<string, ChatSessionResponse['messages']>>({})
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const chatPaneRef = useRef<HTMLDivElement | null>(null)
  const splitLayoutRef = useRef<HTMLDivElement | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)
  const thinkingTimeoutRef = useRef<number | null>(null)
  const rememberedTimeoutRef = useRef<number | null>(null)
  const assistantRequestAbortRef = useRef<AbortController | null>(null)
  const generationPollTimeoutRef = useRef<number | null>(null)
  const attachmentPreviewDataUrlsRef = useRef<Record<string, string>>({})
  const activeGenerationIdRef = useRef<string | null>(null)
  const activeGenerationMessageIdRef = useRef<string | null>(null)
  const activeGenerationContentRef = useRef('')
  const canvasQuestionForGenerationRef = useRef<string | null>(null)
  const canvasGenerationBaselineRef = useRef<CanvasGenerationBaseline | null>(null)
  const { stream, addPart, reset: resetStream, seed: seedStream } = useStream()
  const sidebarOpen = isMobileLayout ? mobileSidebarOpen : desktopSidebarOpen

  const suggestions = useMemo(() => {
    if (!activeTopic) {
      return []
    }

    return suggestionsData[activeTopic]
  }, [activeTopic])
  const visibleSuggestions = useMemo(() => {
    if (!isMobileLayout) {
      return suggestions
    }

    if (showAllMobileSuggestions) {
      return suggestions
    }

    return suggestions.slice(0, 3)
  }, [isMobileLayout, showAllMobileSuggestions, suggestions])
  const hiddenSuggestionCount = suggestions.length - visibleSuggestions.length

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedPreference = loadSelectedModelPreference()
    if (storedPreference && storedPreference !== selectedModel) {
      setSelectedModel(storedPreference)
    }
    // Run once after mount to avoid SSR/client hydration mismatch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const model = selectedModel.trim()
    if (!model) {
      return
    }

    window.localStorage.setItem(selectedModelStorageKey, model)
  }, [selectedModel])

  useEffect(() => {
    if (!queuedCanvasQuestion || !streamingMessageId) {
      return
    }

    setActiveCanvasContext({
      messageId: streamingMessageId,
      question: queuedCanvasQuestion,
    })
    setQueuedCanvasQuestion(null)

    setMessages((previousMessages) =>
      previousMessages.map((message) =>
        message.role === 'assistant'
          ? message.id === streamingMessageId
            ? {
                ...message,
                canvasContext: {
                  question: queuedCanvasQuestion,
                },
              }
            : message
          : message,
      ),
    )
  }, [queuedCanvasQuestion, streamingMessageId])

  useEffect(() => {
    if (!isCanvasPreviewOpen || isMobileLayout || !isPreviewResizeActive) {
      return
    }

    const clampPreviewWidth = (nextWidth: number) => {
      const containerWidth = splitLayoutRef.current?.clientWidth ?? window.innerWidth
      const maxPreviewWidth = Math.max(previewPanelMinWidthPx, containerWidth - chatPanelMinWidthPx)
      return Math.min(maxPreviewWidth, Math.max(previewPanelMinWidthPx, nextWidth))
    }

    const handleMouseMove = (event: MouseEvent) => {
      const containerBounds = splitLayoutRef.current?.getBoundingClientRect()
      if (!containerBounds) {
        return
      }

      const nextWidth = containerBounds.right - event.clientX
      setPreviewPanelWidth(clampPreviewWidth(nextWidth))
    }

    const handleMouseUp = () => {
      setIsPreviewResizeActive(false)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isCanvasPreviewOpen, isMobileLayout, isPreviewResizeActive])

  useEffect(() => {
    if (!isCanvasPreviewOpen || isMobileLayout || previewPanelWidth === null) {
      return
    }

    const clampPreviewWidth = (nextWidth: number) => {
      const containerWidth = splitLayoutRef.current?.clientWidth ?? window.innerWidth
      const maxPreviewWidth = Math.max(previewPanelMinWidthPx, containerWidth - chatPanelMinWidthPx)
      return Math.min(maxPreviewWidth, Math.max(previewPanelMinWidthPx, nextWidth))
    }

    const handleResize = () => {
      setPreviewPanelWidth((currentWidth) => {
        if (currentWidth === null) {
          return currentWidth
        }

        return clampPreviewWidth(currentWidth)
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isCanvasPreviewOpen, isMobileLayout, previewPanelWidth])

  useEffect(() => {
    const paneElement = chatPaneRef.current
    if (!paneElement || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      setChatPaneWidth(entry.contentRect.width)
    })

    observer.observe(paneElement)
    return () => observer.disconnect()
  }, [])

  const avatarNameSource = useMemo(() => fullName.trim() || nickname.trim(), [fullName, nickname])
  const avatarInitials = useMemo(() => getInitials(avatarNameSource), [avatarNameSource])
  const firstName = useMemo(() => getFirstName(fullName, nickname), [fullName, nickname])
  const greetingHeaderParts = useMemo(() => {
    const [beforeName, afterName = ''] = landingGreeting.headerTemplate.split(greetingNameToken)
    return {
      beforeName,
      afterName,
    }
  }, [landingGreeting.headerTemplate])
  const activeChatTitle = useMemo(() => {
    return chatSessions.find((session) => session.id === activeSessionId)?.title ?? 'New chat'
  }, [chatSessions, activeSessionId])
  const sessionsWithBranchDepth = useMemo(() => mapSessionsWithBranchDepth(chatSessions), [chatSessions])
  const groupedSessions = useMemo(() => {
    return sessionsWithBranchDepth.reduce<Record<string, ChatSessionSummary[]>>((accumulator, session) => {
      const bucket = getSessionBucketLabel(session.updatedAt)
      const current = accumulator[bucket] ?? []
      current.push(session)
      accumulator[bucket] = current
      return accumulator
    }, {})
  }, [sessionsWithBranchDepth])
  const activeSession = useMemo(
    () => chatSessions.find((session) => session.id === activeSessionId) ?? null,
    [chatSessions, activeSessionId],
  )
  const isActiveSessionFork = Boolean(activeSession?.parentSessionId)
  const branchesByForkMessageId = useMemo(() => {
    if (!activeSessionId) {
      return {} as Record<number, ChatSessionSummary[]>
    }

    return sessionsWithBranchDepth.reduce<Record<number, ChatSessionSummary[]>>((accumulator, session) => {
      if (session.parentSessionId !== activeSessionId || !session.forkedFromMessageId) {
        return accumulator
      }

      const current = accumulator[session.forkedFromMessageId] ?? []
      current.push(session)
      accumulator[session.forkedFromMessageId] = current
      return accumulator
    }, {})
  }, [sessionsWithBranchDepth, activeSessionId])
  const branchTreeChildrenByParent = useMemo(() => {
    return sessionsWithBranchDepth.reduce<Record<string, ChatSessionSummary[]>>((accumulator, session) => {
      const parentId = session.parentSessionId ?? '__root__'
      const current = accumulator[parentId] ?? []
      current.push(session)
      accumulator[parentId] = current
      return accumulator
    }, {})
  }, [sessionsWithBranchDepth])
  const forkTargetMessage = useMemo(() => {
    if (!forkTargetMessageId) {
      return null
    }

    return messages.find((message) => message.id === forkTargetMessageId) ?? null
  }, [messages, forkTargetMessageId])

  const activeStreamingContent = useMemo(() => {
    if (!streamingMessageId) {
      return ''
    }

    const activeStreamingMessage = messages.find((message) => message.id === streamingMessageId)
    return activeStreamingMessage?.content ?? ''
  }, [messages, streamingMessageId])

  const latestCanvasMessageId = useMemo(() => {
    const latest = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.canvasContext?.question)
    return latest?.id ?? null
  }, [messages])
  const canvasVersionHistory = useMemo(() => {
    const versions: CanvasVersionHistoryItem[] = []
    const dedupe = new Set<string>()

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.role !== 'assistant' || !message.canvasContext?.question) {
        continue
      }

      const parsed = extractCanvasStreamParts(stripAssistantImageMarkdown(message.content))
      const code = parsed.code.trim()
      const question = message.canvasContext.question.trim()
      if (!code || !question) {
        continue
      }

      const fingerprint = `${question}::${code}`
      if (dedupe.has(fingerprint)) {
        continue
      }

      dedupe.add(fingerprint)
      versions.push({
        id: message.id,
        label: `Version ${versions.length + 1}`,
        question,
        code,
      })
    }

    return versions
  }, [messages])

  const canShowChatQuickTemplates = useMemo(() => {
    if (isMobileLayout) {
      return true
    }

    if (chatPaneWidth === null) {
      return true
    }

    return chatPaneWidth >= quickTemplatesMinPaneWidthPx
  }, [chatPaneWidth, isMobileLayout])
  const canShowCenteredHeaderTitle = useMemo(() => {
    if (isMobileLayout) {
      return false
    }

    if (chatPaneWidth === null) {
      return true
    }

    const minWidth = isActiveSessionFork
      ? headerTitleWithBranchMapMinPaneWidthPx
      : headerTitleMinPaneWidthPx

    return chatPaneWidth >= minWidth
  }, [chatPaneWidth, isActiveSessionFork, isMobileLayout])

  const templateSeedText = useMemo(() => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    const seed = lastUserMessage?.content?.trim() ?? ''
    if (!seed) {
      return ''
    }

    return seed.replace(/\s+/g, ' ').slice(0, 220)
  }, [messages])

  const isCodeTemplateContext = useMemo(() => {
    const source = `${templateSeedText} ${messages
      .slice(-4)
      .map((message) => message.content)
      .join(' ')}`.toLowerCase()

    return /(function|class|typescript|javascript|python|bug|error|stack trace|compile|refactor|code|sql|api|tsx|ts|js)/.test(source)
  }, [messages, templateSeedText])

  const hasVerifiableAssistantContext = useMemo(() => {
    return messages.some((message) => {
      if (message.role !== 'assistant') {
        return false
      }

      if (!message.content.trim()) {
        return false
      }

      // Default/demo seeded content usually lacks message ids and metadata from real generations.
      return Boolean(
        message.messageId !== undefined ||
          message.searchedWeb ||
          (message.citations?.length ?? 0) > 0 ||
          (message.memoryContext?.length ?? 0) > 0,
      )
    })
  }, [messages])

  function updateScrollToBottomVisibility(container: HTMLDivElement) {
    const remainingScroll = container.scrollHeight - container.scrollTop - container.clientHeight
    setShowScrollToBottom(remainingScroll > 80)
  }

  function handleMessageListScroll() {
    const container = messageListRef.current
    if (!container) {
      return
    }

    updateScrollToBottomVisibility(container)
  }

  function handleScrollToBottom() {
    const container = messageListRef.current
    if (!container) {
      return
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })

    setShowScrollToBottom(false)
  }

  useEffect(() => {
    setLandingGreeting((previous) => pickLandingGreeting(previous))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(mobileLayoutMediaQuery)
    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches)
    }

    setIsMobileLayout(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleMediaQueryChange)

    return () => {
      mediaQuery.removeEventListener('change', handleMediaQueryChange)
    }
  }, [])

  useEffect(() => {
    if (!isMobileLayout || !sidebarOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isMobileLayout, sidebarOpen])

  useEffect(() => {
    setShowAllMobileSuggestions(false)
  }, [activeTopic])

  const isImageGenerationThinking = useMemo(() => {
    if (!isLoading) {
      return false
    }

    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    if (!lastUserMessage) {
      return false
    }

    return imageGenerationKeywordPattern.test(lastUserMessage.content)
  }, [isLoading, messages])

  function getSessionToken() {
    return window.localStorage.getItem('lovechat_session_token')
  }

  async function saveMemory(content: string, summarizeMode: 'default' | 'assistant_response' | 'user_request' = 'assistant_response') {
    const token = getSessionToken()
    if (!token) {
      setErrorMessage('Your session has expired. Please sign in again.')
      return false
    }

    const normalizedContent = normalizeMemoryContent(content)
    if (!normalizedContent) {
      setErrorMessage('Nothing to save from this response.')
      return false
    }

    setErrorMessage(null)

    const response = await fetch(`${apiBaseUrl}/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: normalizedContent,
        source: 'manual',
        summarize: true,
        summarizeMode,
      }),
    })

    if (!response.ok) {
      let message = 'Unable to save memory'
      try {
        const payload = (await response.json()) as { message?: string }
        if (payload.message) {
          message = payload.message
        }
      } catch {
        // Keep fallback message.
      }

      setErrorMessage(message)
      return false
    }

    return true
  }

  async function handleRememberAssistantMessage(message: ChatMessage) {
    if (message.role !== 'assistant') {
      return
    }

    const assistantIndex = messages.findIndex((candidate) => candidate.id === message.id)
    const previousUserMessage =
      assistantIndex > 0
        ? [...messages.slice(0, assistantIndex)].reverse().find((candidate) => candidate.role === 'user')
        : null

    const memoryContent =
      previousUserMessage?.content || getAssistantCopyContent(message.content) || getAssistantExportContent(message.content)
    if (!memoryContent.trim()) {
      setErrorMessage('Nothing to save from this response.')
      return
    }

    const didSave = await saveMemory(
      memoryContent,
      previousUserMessage ? 'user_request' : 'assistant_response',
    )
    if (!didSave) {
      return
    }

    setRecentlyRememberedMessageId(message.id)
    if (rememberedTimeoutRef.current !== null) {
      window.clearTimeout(rememberedTimeoutRef.current)
    }

    rememberedTimeoutRef.current = window.setTimeout(() => {
      setRecentlyRememberedMessageId(null)
    }, 1800)
  }

  function sortSessionsByUpdatedAt(list: ChatSessionSummary[]) {
    return [...list].sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })
  }

  function materializeMessages(items: ChatSessionResponse['messages']) {
    return items.map((item) => {
      const citations = normalizeCitations(item.citations)
      const memoryContext = normalizeMemoryContext(item.memoryContext)
      const attachments = normalizeAttachments(item.attachments)
      const canvasContext = normalizeCanvasContext(item.canvasContext)
      return createMessage(item.role, item.content, {
        ...(item.messageId !== undefined ? { messageId: item.messageId } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(canvasContext ? { canvasContext } : {}),
        ...(citations.length > 0 ? { citations } : {}),
        ...(memoryContext.length > 0 ? { memoryContext } : {}),
        ...(item.searchedWeb !== undefined ? { searchedWeb: item.searchedWeb } : {}),
      })
    })
  }

  function stopGenerationPolling() {
    if (generationPollTimeoutRef.current !== null) {
      window.clearTimeout(generationPollTimeoutRef.current)
      generationPollTimeoutRef.current = null
    }

    activeGenerationIdRef.current = null
    activeGenerationMessageIdRef.current = null
    activeGenerationContentRef.current = ''
  }

  function ensureGenerationMessage(messageId: string, content: string) {
    setMessages((previousMessages) => {
      const existingIndex = previousMessages.findIndex((message) => message.id === messageId)

      if (existingIndex < 0) {
        return [
          ...previousMessages,
          {
            id: messageId,
            role: 'assistant',
            content,
          },
        ]
      }

      return previousMessages.map((message) => {
        if (message.id !== messageId) {
          return message
        }

        return {
          ...message,
          content,
        }
      })
    })
  }

  function startGenerationPolling(
    generationId: string,
    sessionId: string,
    generationMessageId: string,
    initialContent = '',
    initialStatus: 'queued' | 'in_progress' = 'in_progress',
  ) {
    const token = getSessionToken()
    if (!token) {
      stopGenerationPolling()
      setIsLoading(false)
      return
    }

    stopGenerationPolling()
    activeGenerationIdRef.current = generationId
    activeGenerationMessageIdRef.current = generationMessageId
    activeGenerationContentRef.current = initialContent
    setSessionGenerationStatus(sessionId, initialStatus)

    seedStream(initialContent)
    setStreamingMessageId(generationMessageId)
    setIsLoading(true)

    const pollOnce = async () => {
      if (activeGenerationIdRef.current !== generationId) {
        return
      }

      let response: Response
      try {
        response = await fetch(`${apiBaseUrl}/chat/generations/${generationId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      } catch {
        if (activeGenerationIdRef.current === generationId) {
          generationPollTimeoutRef.current = window.setTimeout(() => {
            void pollOnce()
          }, 1200)
        }
        return
      }

      if (!response.ok) {
        let message = 'Unable to resume assistant generation'
        try {
          const payload = (await response.json()) as { message?: string }
          if (payload.message) {
            message = payload.message
          }
        } catch {
          // Keep fallback message.
        }

        stopGenerationPolling()
        setStreamingMessageId(null)
        setIsLoading(false)
        setErrorMessage(message)
        return
      }

      const payload = (await response.json()) as ChatGenerationResponse
      const generation = payload.generation

      touchSession(generation.chatSessionId, generation.sessionTitle)

      const previousContent = activeGenerationContentRef.current
      const nextContent = generation.content || ''

      if (nextContent !== previousContent) {
        const shouldPreserveExistingContent = previousContent.length > 0 && nextContent.length === 0
        const shouldDeferCanvasInterimUpdate =
          Boolean(canvasGenerationBaselineRef.current) &&
          previousContent.length > 0 &&
          extractCanvasStreamParts(stripAssistantImageMarkdown(nextContent)).code.length === 0 &&
          generation.status !== 'completed'

        if (!shouldPreserveExistingContent && !shouldDeferCanvasInterimUpdate) {
          ensureGenerationMessage(generationMessageId, nextContent)
          activeGenerationContentRef.current = nextContent

          if (nextContent.trim().length > 0) {
            if (thinkingTimeoutRef.current !== null) {
              window.clearTimeout(thinkingTimeoutRef.current)
              thinkingTimeoutRef.current = null
            }
            setShowThinking(false)
          }

          if (nextContent.startsWith(previousContent)) {
            const delta = nextContent.slice(previousContent.length)
            if (delta) {
              addPart(delta)
            }
          } else {
            resetStream()
            if (nextContent) {
              addPart(nextContent)
            }
          }
        }
      }

      if (generation.status === 'completed') {
        const citations = normalizeCitations(generation.citations)
        const memoryContext = normalizeMemoryContext(generation.memoryContext)
        const followUps = normalizeFollowUps(generation.followUps)
        const searchedWeb = Boolean(generation.searchedWeb ?? citations.length > 0)
        const finalizedContent = generation.content || ''
        const preservedCanvasContent = preserveCanvasResponseContent(
          finalizedContent,
          canvasGenerationBaselineRef.current,
        )

        setMessages((previousMessages) =>
          previousMessages.map((message) =>
            message.role === 'assistant'
              ? message.id === generationMessageId
                ? {
                    ...message,
                    content: preservedCanvasContent,
                    ...(canvasQuestionForGenerationRef.current
                      ? {
                          canvasContext: {
                            question: canvasQuestionForGenerationRef.current,
                          },
                        }
                      : {}),
                    ...(citations.length > 0 ? { citations } : {}),
                    ...(memoryContext.length > 0 ? { memoryContext } : {}),
                    searchedWeb,
                  }
                : message
              : message,
          ),
        )

        const finalizedCanvasQuestion = canvasQuestionForGenerationRef.current
        if (isCanvasPreviewOpen && finalizedCanvasQuestion) {
          setCanvasPreviewPayload(
            buildCanvasPreviewPayload(
              preservedCanvasContent,
              finalizedCanvasQuestion,
              canvasGenerationBaselineRef.current,
            ),
          )
          setIsCanvasPreviewOpen(true)
        }

        if (typeof generation.thinking === 'string' && generation.thinking.trim()) {
          setThinkingText(generation.thinking)
          setShowThinking(true)
        }

        setAiFollowUps(followUps)

        stopGenerationPolling()
        setSessionGenerationStatus(generation.chatSessionId, null)
        setStreamingMessageId(null)
        setIsLoading(false)
        setIsCanvasPreviewUpdating(false)
        canvasQuestionForGenerationRef.current = null
        canvasGenerationBaselineRef.current = null
        return
      }

      if (generation.status === 'failed') {
        stopGenerationPolling()
        setSessionGenerationStatus(generation.chatSessionId, null)
        setStreamingMessageId(null)
        setIsLoading(false)
        setErrorMessage(generation.errorMessage || 'Unable to complete chat response')
        setIsCanvasPreviewUpdating(false)
        canvasQuestionForGenerationRef.current = null
        canvasGenerationBaselineRef.current = null
        return
      }

      generationPollTimeoutRef.current = window.setTimeout(() => {
        void pollOnce()
      }, 700)
    }

    void pollOnce()
  }

  function resumeActiveGeneration(sessionId: string, generation: ChatSessionResponse['activeGeneration']) {
    if (!generation) {
      return
    }

    const generationId = generation.id
    const generationMessageId = `assistant-generation-${generationId}`
    const generationContent = generation.content || ''
    setAiFollowUps(normalizeFollowUps(generation.followUps))

    setActiveSessionId(sessionId)
    ensureGenerationMessage(generationMessageId, generationContent)
    startGenerationPolling(generationId, sessionId, generationMessageId, generationContent, generation.status)
  }

  async function createChatSession() {
    const token = getSessionToken()
    if (!token) {
      setErrorMessage('Your session has expired. Please sign in again.')
      return null
    }

    const response = await fetch(`${apiBaseUrl}/chat/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'New chat',
      }),
    })

    if (!response.ok) {
      let message = 'Unable to create chat session'
      try {
        const payload = (await response.json()) as { message?: string }
        if (payload.message) {
          message = payload.message
        }
      } catch {
        // Keep fallback message.
      }

      setErrorMessage(message)
      return null
    }

    const payload = (await response.json()) as { session: ChatSessionSummary }
    return payload.session
  }

  async function ensureActiveSession() {
    if (activeSessionId) {
      return activeSessionId
    }

    const createdSession = await createChatSession()
    if (!createdSession) {
      return null
    }

    setActiveSessionId(createdSession.id)
    setChatSessions((previousSessions) => sortSessionsByUpdatedAt([createdSession, ...previousSessions]))
    return createdSession.id
  }

  function touchSession(sessionId: string, nextTitle?: string) {
    const normalizedNextTitle = nextTitle?.trim()
    const now = new Date().toISOString()

    setChatSessions((previousSessions) => {
      const existing = previousSessions.find((session) => session.id === sessionId)
      if (!existing) {
        return sortSessionsByUpdatedAt([
          {
            id: sessionId,
            title: normalizedNextTitle || 'New chat',
            createdAt: now,
            updatedAt: now,
            parentSessionId: null,
            forkedFromMessageId: null,
          },
          ...previousSessions,
        ])
      }

      const updatedSessions = previousSessions.map((session) => {
        if (session.id !== sessionId) {
          return session
        }

        return {
          ...session,
          title: normalizedNextTitle || session.title,
          updatedAt: now,
        }
      })

      return sortSessionsByUpdatedAt(updatedSessions)
    })
  }

  function setSessionGenerationStatus(sessionId: string, generationStatus: 'queued' | 'in_progress' | null) {
    setChatSessions((previousSessions) =>
      previousSessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              generationStatus,
            }
          : session,
      ),
    )
  }

  async function refreshSessionStatuses() {
    const token = getSessionToken()
    if (!token) {
      return
    }

    try {
      const response = await fetch(`${apiBaseUrl}/chat/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as ChatSessionsResponse
      setChatSessions(sortSessionsByUpdatedAt(payload.sessions))
    } catch {
      // Ignore transient refresh failures.
    }
  }

  async function loadChatSessions() {
    const token = getSessionToken()
    if (!token) {
      setIsSessionsLoading(false)
      return
    }

    const response = await fetch(`${apiBaseUrl}/chat/sessions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      let message = 'Unable to load chat sessions'
      try {
        const payload = (await response.json()) as { message?: string }
        if (payload.message) {
          message = payload.message
        }
      } catch {
        // Keep fallback message.
      }

      setErrorMessage(message)
      setIsSessionsLoading(false)
      return
    }

    const payload = (await response.json()) as ChatSessionsResponse
    setChatSessions(sortSessionsByUpdatedAt(payload.sessions))

    if (payload.sessions.length === 0) {
      stopGenerationPolling()
      setActiveSessionId(null)
      setMessages([])
      setIsSessionsLoading(false)
      return
    }

    const requestedSessionId = new URLSearchParams(window.location.search).get('session')
    const hasRequestedSession =
      typeof requestedSessionId === 'string' &&
      payload.sessions.some((session) => session.id === requestedSessionId)

    const nextActiveId = hasRequestedSession ? requestedSessionId : payload.sessions[0].id
    setActiveSessionId(nextActiveId)

    const detailResponse = await fetch(`${apiBaseUrl}/chat/sessions/${nextActiveId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!detailResponse.ok) {
      let message = 'Unable to load chat history'
      try {
        const detailError = (await detailResponse.json()) as { message?: string }
        if (detailError.message) {
          message = detailError.message
        }
      } catch {
        // Keep fallback message.
      }

      setErrorMessage(message)
      setIsSessionsLoading(false)
      return
    }

    const detailPayload = (await detailResponse.json()) as ChatSessionResponse
    setMessages(materializeMessages(detailPayload.messages))
    setAiFollowUps([])
    resumeActiveGeneration(nextActiveId, detailPayload.activeGeneration)
    setIsSessionsLoading(false)
  }

  async function openSession(sessionId: string) {
    const token = getSessionToken()
    if (!token) {
      return
    }

    setErrorMessage(null)
  stopGenerationPolling()
    setActiveSessionId(sessionId)
    setEditingMessageId(null)
    setEditingDraft('')
    setStreamingMessageId(null)
    resetStream()

    const response = await fetch(`${apiBaseUrl}/chat/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      let message = 'Unable to open chat session'
      try {
        const payload = (await response.json()) as { message?: string }
        if (payload.message) {
          message = payload.message
        }
      } catch {
        // Keep fallback message.
      }

      setErrorMessage(message)
      return
    }

    const payload = (await response.json()) as ChatSessionResponse
    setMessages(materializeMessages(payload.messages))
    setAiFollowUps([])
    resumeActiveGeneration(sessionId, payload.activeGeneration)
    setActiveTopic(null)
  }

  async function handleCreateNewChat() {
    setErrorMessage(null)
    const createdSession = await createChatSession()
    if (!createdSession) {
      return
    }

    setChatSessions((previousSessions) => sortSessionsByUpdatedAt([createdSession, ...previousSessions]))
    setActiveSessionId(createdSession.id)
    setMessages([])
    setAiFollowUps([])
    setLandingGreeting((previous) => pickLandingGreeting(previous))
    setPrompt('')
    setEditingMessageId(null)
    setEditingDraft('')
    setActiveTopic(null)
    stopGenerationPolling()
    setStreamingMessageId(null)
    resetStream()
  }

  async function handleRenameSession(sessionId: string, nextTitle: string) {
    const token = getSessionToken()
    if (!token) {
      return false
    }

    const normalizedTitle = nextTitle.trim()
    if (!normalizedTitle) {
      return false
    }

    const response = await fetch(`${apiBaseUrl}/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: normalizedTitle }),
    })

    if (!response.ok) {
      let message = 'Unable to rename chat session'
      try {
        const payload = (await response.json()) as { message?: string }
        if (payload.message) {
          message = payload.message
        }
      } catch {
        // Keep fallback message.
      }

      setErrorMessage(message)
      return false
    }

    const payload = (await response.json()) as { session: ChatSessionSummary }
    setChatSessions((previousSessions) =>
      sortSessionsByUpdatedAt(
        previousSessions.map((existing) =>
          existing.id === payload.session.id
            ? {
                ...existing,
                title: payload.session.title,
                updatedAt: payload.session.updatedAt,
              }
            : existing,
        ),
      ),
    )

    return true
  }

  async function handleDeleteSession(sessionId: string) {
    const token = getSessionToken()
    if (!token) {
      setErrorMessage('Your session has expired. Please sign in again.')
      setSessionIdPendingDelete(null)
      return
    }

    let response: Response
    try {
      response = await fetch(`${apiBaseUrl}/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
    } catch {
      setErrorMessage('Network error while deleting chat session')
      setSessionIdPendingDelete(null)
      return
    }

    if (!response.ok && response.status !== 404) {
      let message = 'Unable to delete chat session'
      try {
        const payload = (await response.json()) as { message?: string }
        if (payload.message) {
          message = payload.message
        }
      } catch {
        // Keep fallback message.
      }

      setErrorMessage(message)
      setSessionIdPendingDelete(null)
      return
    }

    setSessionIdPendingDelete(null)
    setChatSessions((previousSessions) => previousSessions.filter((session) => session.id !== sessionId))

    if (activeSessionId !== sessionId) {
      return
    }

    const remaining = chatSessions.filter((session) => session.id !== sessionId)
    if (remaining.length === 0) {
      setActiveSessionId(null)
      setMessages([])
      setLandingGreeting((previous) => pickLandingGreeting(previous))
      return
    }

    const nextActive = remaining[0]
    setActiveSessionId(nextActive.id)
    await openSession(nextActive.id)
  }

  useEffect(() => {
    const cachedProfile = window.localStorage.getItem('lovechat_onboarding_profile')
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile) as { fullName?: string; nickname?: string; avatarDataUrl?: string | null }
        if (parsed.fullName) {
          setFullName(parsed.fullName)
        }
        if (parsed.nickname) {
          setNickname(parsed.nickname)
        }
        if (typeof parsed.avatarDataUrl === 'string' || parsed.avatarDataUrl === null) {
          setAvatarDataUrl(parsed.avatarDataUrl)
        }
      } catch {
        // Ignore invalid local cache data.
      }
    }

    const token = window.localStorage.getItem('lovechat_session_token')
    if (!token) {
      return
    }

    let cancelled = false

    async function loadOnboardingProfile() {
      try {
        const response = await fetch(`${apiBaseUrl}/onboarding/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as OnboardingProfileResponse
        if (cancelled) {
          return
        }

        setFullName(payload.profile.fullName)
        setNickname(payload.profile.nickname)
      } catch {
        // Leave default placeholders when profile fetch fails.
      }
    }

    async function loadAccountProfile() {
      try {
        const response = await fetch(`${apiBaseUrl}/account/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          return false
        }

        const payload = (await response.json()) as AccountProfileResponse
        if (cancelled) {
          return true
        }

        setFullName(payload.profile.fullName)
        setNickname(payload.profile.nickname)
        setAvatarDataUrl(payload.profile.avatarDataUrl)

        window.localStorage.setItem(
          'lovechat_onboarding_profile',
          JSON.stringify({
            fullName: payload.profile.fullName,
            nickname: payload.profile.nickname,
            avatarDataUrl: payload.profile.avatarDataUrl,
          }),
        )

        return true
      } catch {
        return false
      }
    }

    void (async () => {
      const loadedAccountProfile = await loadAccountProfile()
      if (!loadedAccountProfile) {
        await loadOnboardingProfile()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl])

  useEffect(() => {
    let cancelled = false

    async function loadInitialSessions() {
      try {
        await loadChatSessions()
      } catch {
        if (!cancelled) {
          setErrorMessage('Unable to load chat history')
          setIsSessionsLoading(false)
        }
      }
    }

    void loadInitialSessions()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl])

  useEffect(() => {
    const hasBackgroundGenerations = chatSessions.some(
      (session) => session.generationStatus === 'queued' || session.generationStatus === 'in_progress',
    )

    if (!hasBackgroundGenerations) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshSessionStatuses()
    }, 2500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [chatSessions, apiBaseUrl])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (activeSessionId) {
      url.searchParams.set('session', activeSessionId)
    } else {
      url.searchParams.delete('session')
    }

    window.history.replaceState({}, '', url)
  }, [activeSessionId])

  useEffect(() => {
    if (!isRenameDialogOpen || !renameInputRef.current) {
      return
    }

    renameInputRef.current.focus()
    renameInputRef.current.select()
  }, [isRenameDialogOpen])

  useEffect(() => {
    if (messages.length === 0) {
      setShowScrollToBottom(false)
      return
    }

    const container = messageListRef.current
    if (!container) {
      return
    }

    container.scrollTop = container.scrollHeight
    updateScrollToBottomVisibility(container)
  }, [messages, isLoading])

  useEffect(() => {
    return () => {
      assistantRequestAbortRef.current?.abort()
      stopGenerationPolling()

      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }

      if (thinkingTimeoutRef.current !== null) {
        window.clearTimeout(thinkingTimeoutRef.current)
      }

      if (rememberedTimeoutRef.current !== null) {
        window.clearTimeout(rememberedTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (thinkingTimeoutRef.current !== null) {
      window.clearTimeout(thinkingTimeoutRef.current)
      thinkingTimeoutRef.current = null
    }

    setShowThinking(false)
  }, [isLoading])

  useEffect(() => {
    if (!streamingMessageId) {
      return
    }

    const activeMessage = messages.find((message) => message.id === streamingMessageId)
    if (!activeMessage) {
      setStreamingMessageId(null)
      return
    }

    // Keep typewriter mode active while backend generation is still in progress.
    if (activeGenerationIdRef.current !== null) {
      return
    }

    if (stream && stream === activeMessage.content) {
      setStreamingMessageId(null)
    }
  }, [messages, stream, streamingMessageId])

  function handleLogout() {
    window.localStorage.removeItem('lovechat_session_token')
    window.localStorage.removeItem('lovechat_onboarding_profile')
    void navigate({ to: '/sign-in' })
  }

  function handleStopAssistantResponse() {
    assistantRequestAbortRef.current?.abort('manual')
    assistantRequestAbortRef.current = null
    stopGenerationPolling()

    if (thinkingTimeoutRef.current !== null) {
      window.clearTimeout(thinkingTimeoutRef.current)
      thinkingTimeoutRef.current = null
    }

    setShowThinking(false)
    setIsLoading(false)
    setIsCanvasPreviewUpdating(false)
    canvasQuestionForGenerationRef.current = null
    canvasGenerationBaselineRef.current = null
  }

  function handleOpenProfile() {
    void navigate({ to: '/onboarding' })
  }

  function handleOpenSettings() {
    setIsSettingsOpen(true)
  }

  async function handleCopyShareLink() {
    try {
      const url = new URL(window.location.href)
      if (activeSessionId) {
        url.searchParams.set('session', activeSessionId)
      } else {
        url.searchParams.delete('session')
      }

      await navigator.clipboard.writeText(url.toString())
    } catch {
      setErrorMessage('Unable to copy chat link to clipboard')
    }
  }

  function downloadTextFile(content: string, fileName: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function buildMarkdownExportContent() {
    const parts: string[] = []
    parts.push('# LoveChat Export')
    parts.push('')
    parts.push(`Exported: ${new Date().toLocaleString()}`)
    parts.push('')

    if (messages.length === 0) {
      parts.push('_No messages in this chat yet._')
      return parts.join('\n')
    }

    for (const message of messages) {
      const heading = message.role === 'user' ? '## You' : '## LoveChat'
      parts.push(heading)
      parts.push('')
      const messageBody =
        message.role === 'assistant'
          ? getAssistantExportContent(message.content)
          : message.content.trim()

      parts.push(messageBody || '_Empty message_')

      if (message.attachments && message.attachments.length > 0) {
        parts.push('')
        parts.push('Attachments:')
        for (const attachment of message.attachments) {
          parts.push(`- ${attachment.name} (${getAttachmentTypeLabel(attachment)}, ${formatFileSize(attachment.size)})`)
        }
      }

      parts.push('')
    }

    return parts.join('\n').trimEnd()
  }

  function handleExportMarkdown() {
    const activeTitle = chatSessions.find((session) => session.id === activeSessionId)?.title ?? 'chat'
    const fileName = `${slugifyFilename(activeTitle, 'chat')}.md`
    const content = buildMarkdownExportContent()
    downloadTextFile(content, fileName, 'text/markdown;charset=utf-8')
  }

  function handleExportPdf() {
    const activeTitle = chatSessions.find((session) => session.id === activeSessionId)?.title ?? 'LoveChat Export'
    const renderedAssistantBlocks = Array.from(
      document.querySelectorAll<HTMLElement>('[data-export-assistant-markdown]'),
    )
    let assistantBlockIndex = 0

    const renderedMessages =
      messages.length === 0
        ? '<p class="export-empty">No messages in this chat yet.</p>'
        : messages
            .map((message) => {
              const author = message.role === 'user' ? 'You' : 'LoveChat'
              const fallbackSource =
                message.role === 'assistant'
                  ? getAssistantExportContent(message.content)
                  : message.content
              const fallbackBody = escapeHtml(fallbackSource).replace(/\n/g, '<br/>') || '<em>Empty message</em>'
              const assistantRendered = renderedAssistantBlocks[assistantBlockIndex]?.innerHTML
              if (message.role === 'assistant') {
                assistantBlockIndex += 1
              }

              const messageBody =
                message.role === 'assistant' && assistantRendered && assistantRendered.trim().length > 0
                  ? assistantRendered
                  : fallbackBody

              const attachments = message.attachments?.length
                ? `<ul class="export-attachments">${message.attachments
                    .map(
                      (attachment) =>
                        `<li>${escapeHtml(attachment.name)} <span class="export-attachment-meta">(${escapeHtml(getAttachmentTypeLabel(attachment))}, ${escapeHtml(formatFileSize(attachment.size))})</span></li>`,
                    )
                    .join('')}</ul>`
                : ''

              const roleClass = message.role === 'user' ? 'export-message-user' : 'export-message-assistant'
              return `<article class="export-message ${roleClass}"><header class="export-message-header">${escapeHtml(author)}</header><div class="export-message-body">${messageBody}</div>${attachments}</article>`
            })
            .join('')

    const printableDocument = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(activeTitle)}</title>
    <style>
      @page { margin: 0.75in; }
      :root {
        color: #0f172a;
        font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 160px, #ffffff 280px);
        color: #0f172a;
        line-height: 1.7;
        font-size: 12.5px;
      }
      .export-shell {
        max-width: 860px;
        margin: 0 auto;
        padding: 24px 24px 18px;
      }
      .export-header {
        border-radius: 14px;
        border: 1px solid #d6e3ff;
        background: linear-gradient(165deg, #edf3ff 0%, #f7faff 52%, #ffffff 100%);
        padding: 16px 18px;
        margin-bottom: 16px;
      }
      .export-title {
        margin: 0;
        font-family: 'Avenir Next', 'Segoe UI', sans-serif;
        font-size: 26px;
        font-weight: 700;
        line-height: 1.25;
        letter-spacing: -0.01em;
      }
      .export-meta {
        margin: 6px 0 0;
        color: #475569;
        font-size: 11px;
      }
      .export-empty {
        margin: 8px 0 0;
        color: #475569;
      }
      .export-message {
        margin: 0 0 12px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: visible;
        break-inside: auto;
        page-break-inside: auto;
      }
      .export-message-user {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .export-message-assistant {
        break-inside: auto;
        page-break-inside: auto;
      }
      .export-message-header {
        border-bottom: 1px solid #edf2f7;
        background: #f8fafc;
        color: #334155;
        font-family: 'Avenir Next', 'Segoe UI', sans-serif;
        font-size: 10.5px;
        letter-spacing: 0.09em;
        font-weight: 700;
        text-transform: uppercase;
        padding: 9px 12px;
      }
      .export-message-body {
        padding: 12px 14px;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .export-message-body h1,
      .export-message-body h2,
      .export-message-body h3,
      .export-message-body h4,
      .export-message-body pre,
      .export-message-body table,
      .export-message-body blockquote {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .export-message-body > *:first-child { margin-top: 0 !important; }
      .export-message-body > *:last-child { margin-bottom: 0 !important; }
      .export-message-body p,
      .export-message-body ul,
      .export-message-body ol,
      .export-message-body blockquote,
      .export-message-body pre,
      .export-message-body table,
      .export-message-body h1,
      .export-message-body h2,
      .export-message-body h3,
      .export-message-body h4 {
        margin-top: 0.5em;
        margin-bottom: 0.5em;
      }
      .export-message-body h1,
      .export-message-body h2,
      .export-message-body h3,
      .export-message-body h4 {
        line-height: 1.3;
        letter-spacing: -0.01em;
      }
      .export-message-body code {
        font-family: 'ui-monospace', 'SF Mono', Menlo, Monaco, monospace;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 0.88em;
        padding: 0.08em 0.35em;
      }
      .export-message-body pre {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 10px;
        padding: 10px 12px;
        overflow-x: auto;
      }
      .export-message-body pre code {
        border: 0;
        background: transparent;
        color: inherit;
        padding: 0;
      }
      .export-message-body blockquote {
        border-left: 3px solid #cbd5e1;
        margin-left: 0;
        padding-left: 10px;
        color: #334155;
      }
      .export-message-body table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .export-message-body th,
      .export-message-body td {
        border: 1px solid #e2e8f0;
        padding: 6px 8px;
        vertical-align: top;
      }
      .export-message-body th {
        background: #f8fafc;
        font-weight: 600;
      }
      .export-message-body .katex-display {
        overflow-x: auto;
        overflow-y: hidden;
        padding: 0.2em 0;
      }
      .export-message-body button,
      .export-message-body [aria-label*="Copy"],
      .export-message-body [title*="Copy"] {
        display: none !important;
      }
      .export-attachments {
        margin: 0;
        padding: 0 14px 12px 32px;
        color: #334155;
      }
      .export-attachment-meta {
        color: #64748b;
      }
    </style>
  </head>
  <body>
    <main class="export-shell">
      <header class="export-header">
        <h1 class="export-title">${escapeHtml(activeTitle)}</h1>
        <p class="export-meta">Exported ${escapeHtml(new Date().toLocaleString())}</p>
      </header>
      ${renderedMessages}
    </main>
  </body>
</html>`

    const printFrame = document.createElement('iframe')
    printFrame.setAttribute('aria-hidden', 'true')
    printFrame.style.position = 'fixed'
    printFrame.style.width = '0'
    printFrame.style.height = '0'
    printFrame.style.border = '0'
    printFrame.style.opacity = '0'
    printFrame.style.pointerEvents = 'none'

    const cleanupFrame = () => {
      printFrame.remove()
    }

    let hasPrinted = false

    printFrame.onload = () => {
      if (hasPrinted) {
        return
      }

      hasPrinted = true
      const frameWindow = printFrame.contentWindow
      const frameDocument = printFrame.contentDocument
      if (!frameWindow || !frameDocument) {
        cleanupFrame()
        setErrorMessage('Unable to open print dialog. Please try again.')
        return
      }

      // Bring over app/runtime styles (including KaTeX CSS) so markdown and math render correctly in print.
      const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      for (const styleNode of styleNodes) {
        if (styleNode instanceof HTMLStyleElement) {
          if (!styleNode.textContent) {
            continue
          }

          const clonedStyle = frameDocument.createElement('style')
          clonedStyle.textContent = styleNode.textContent
          frameDocument.head.insertBefore(clonedStyle, frameDocument.head.firstChild)
          continue
        }

        if (!(styleNode instanceof HTMLLinkElement)) {
          continue
        }

        if (!styleNode.href || !styleNode.href.startsWith(window.location.origin)) {
          continue
        }

        const clonedLink = frameDocument.createElement('link')
        clonedLink.rel = 'stylesheet'
        clonedLink.href = styleNode.href
        frameDocument.head.insertBefore(clonedLink, frameDocument.head.firstChild)
      }

      const waitForStyles = Promise.all(
        Array.from(frameDocument.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(
          (link) =>
            new Promise<void>((resolve) => {
              if (link.sheet) {
                resolve()
                return
              }

              const resolveOnce = () => {
                link.removeEventListener('load', resolveOnce)
                link.removeEventListener('error', resolveOnce)
                resolve()
              }

              link.addEventListener('load', resolveOnce, { once: true })
              link.addEventListener('error', resolveOnce, { once: true })
              frameWindow.setTimeout(resolveOnce, 1200)
            }),
        ),
      )

      const waitForFonts = frameDocument.fonts.ready

      const cleanupAfterPrint = () => {
        frameWindow.removeEventListener('afterprint', cleanupAfterPrint)
        frameWindow.clearTimeout(cleanupFallbackTimer)
        setTimeout(cleanupFrame, 0)
      }

      const cleanupFallbackTimer = frameWindow.setTimeout(cleanupFrame, 60_000)
      frameWindow.addEventListener('afterprint', cleanupAfterPrint)

      void Promise.all([waitForStyles, waitForFonts]).then(() => {
        frameWindow.requestAnimationFrame(() => {
          frameWindow.requestAnimationFrame(() => {
            frameWindow.focus()
            frameWindow.print()
          })
        })
      })
    }

    printFrame.srcdoc = printableDocument
    document.body.appendChild(printFrame)
  }

  async function handleRenameActiveChat() {
    if (!activeSessionId) {
      setErrorMessage('No active chat to rename')
      return
    }

    const currentTitle = chatSessions.find((session) => session.id === activeSessionId)?.title ?? 'New chat'
    setRenameDialogDraft(currentTitle)
    setIsRenameDialogOpen(true)
  }

  function closeRenameDialog() {
    if (isRenameSaving) {
      return
    }

    setIsRenameDialogOpen(false)
    setRenameDialogDraft('')
  }

  async function submitRenameDialog() {
    if (!activeSessionId || isRenameSaving) {
      return
    }

    const normalizedTitle = renameDialogDraft.trim()
    if (!normalizedTitle) {
      return
    }

    setIsRenameSaving(true)
    try {
      const didRename = await handleRenameSession(activeSessionId, normalizedTitle)
      if (didRename) {
        setIsRenameDialogOpen(false)
        setRenameDialogDraft('')
      }
    } finally {
      setIsRenameSaving(false)
    }
  }

  function handleClearActiveChat() {
    if (messages.length === 0) {
      return
    }

    setIsClearDialogOpen(true)
  }

  function closeClearDialog() {
    setIsClearDialogOpen(false)
  }

  function confirmClearDialog() {
    setIsClearDialogOpen(false)

    setMessages([])
    setLandingGreeting((previous) => pickLandingGreeting(previous))
    setPrompt('')
    setActiveTopic(null)
    setEditingMessageId(null)
    setEditingDraft('')
    stopGenerationPolling()
    setStreamingMessageId(null)
    resetStream()
  }

  function openAttachmentPreview(attachment: ChatAttachment) {
    setActiveAttachmentPreview(attachment)
  }

  function closeAttachmentPreview() {
    setActiveAttachmentPreview(null)
  }

  async function cacheAttachmentPreviewDataUrls(files: File[], attachments: ChatAttachment[]) {
    const entries = await Promise.all(
      attachments.map(async (attachment, index) => {
        const sourceFile = files[index]

        if (sourceFile.size > attachmentPreviewDataUrlLimit || !shouldCacheAttachmentPreview(sourceFile)) {
          return null
        }

        try {
          const dataUrl = await fileToDataUrl(sourceFile)
          return [attachment.id, dataUrl] as const
        } catch {
          return null
        }
      }),
    )

    const nextEntries = entries.filter((entry): entry is readonly [string, string] => entry !== null)
    if (nextEntries.length === 0) {
      return
    }

    attachmentPreviewDataUrlsRef.current = {
      ...attachmentPreviewDataUrlsRef.current,
      ...Object.fromEntries(nextEntries),
    }
  }

  function handleDeleteActiveChat() {
    if (!activeSessionId) {
      setErrorMessage('No active chat to delete')
      return
    }

    setSessionIdPendingDelete(activeSessionId)
  }

  async function requestAssistantReply(
    history: ChatMessage[],
    chatSessionId: string,
    options?: RequestAssistantReplyOptions,
  ) {
    const chatSessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const modelForRequest = selectedModel.trim().slice(0, 80)
    const normalizedCanvasQuestion = options?.canvasQuestion?.trim().slice(0, 8_000)
    const normalizedChatSessionId = chatSessionIdPattern.test(chatSessionId) ? chatSessionId : undefined

    const clearPendingRequestState = () => {
      if (thinkingTimeoutRef.current !== null) {
        window.clearTimeout(thinkingTimeoutRef.current)
        thinkingTimeoutRef.current = null
      }

      setShowThinking(false)
      setIsLoading(false)
      setIsCanvasPreviewUpdating(false)
      canvasQuestionForGenerationRef.current = null
      canvasGenerationBaselineRef.current = null
    }

    setThinkingText(defaultThinkingText)
    setShowThinking(false)

    if (thinkingTimeoutRef.current !== null) {
      window.clearTimeout(thinkingTimeoutRef.current)
    }

    thinkingTimeoutRef.current = window.setTimeout(() => {
      setShowThinking(true)
    }, thinkingRevealDelayMs)

    const recentHistory = history.slice(-12)
    const completionMessages = recentHistory
      .map((message) => {
        const normalizedContent = message.content.trim().slice(0, 8_000)
        if (!normalizedContent) {
          return null
        }

        const normalizedCanvasQuestion = message.canvasContext?.question?.trim().slice(0, 8_000)
        const normalizedAttachments = (message.attachments ?? [])
          .slice(0, 10)
          .map((attachment) => {
            const name = attachment.name.trim()
            const mimeType = attachment.mimeType.trim()
            if (!name || !mimeType) {
              return null
            }

            const normalizedTextContent = attachment.textContent?.trim().slice(0, 20_000)
            const normalizedImageDataUrl = attachment.imageDataUrl?.slice(0, 6_000_000)

            return {
              id: attachment.id,
              name,
              mimeType,
              size: Math.max(0, Math.min(Math.floor(attachment.size), 30_000_000)),
              ...(normalizedTextContent ? { textContent: normalizedTextContent } : {}),
              ...(normalizedImageDataUrl ? { imageDataUrl: normalizedImageDataUrl } : {}),
            }
          })
          .filter((attachment): attachment is ChatAttachment => attachment !== null)

        return {
          role: message.role,
          content: normalizedContent,
          ...(normalizedAttachments.length > 0 ? { attachments: normalizedAttachments } : {}),
          ...(normalizedCanvasQuestion ? { canvasContext: { question: normalizedCanvasQuestion } } : {}),
          ...(message.citations ? { citations: message.citations } : {}),
          ...(message.searchedWeb !== undefined ? { searchedWeb: message.searchedWeb } : {}),
        }
      })
      .filter((message): message is {
        role: ChatRole
        content: string
        attachments?: ChatAttachment[]
        canvasContext?: CanvasContext
        citations?: SerializableCitation[]
        searchedWeb?: boolean
      } => message !== null)

    if (completionMessages.length === 0) {
      clearPendingRequestState()
      setErrorMessage('Unable to send message: conversation payload was empty after normalization.')
      return
    }
    const token = window.localStorage.getItem('lovechat_session_token')
    const lastUserMessage = [...recentHistory].reverse().find((message) => message.role === 'user')
    const keywordActivatedWebSearch =
      typeof lastUserMessage?.content === 'string' && webSearchKeywordPattern.test(lastUserMessage.content)

    const controller = new AbortController()
    assistantRequestAbortRef.current = controller
    const timeoutId = window.setTimeout(() => {
      controller.abort('timeout')
    }, assistantRequestTimeoutMs)

    let response: Response
    try {
      response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          model: modelForRequest,
          useWebSearch: webSearchActive || keywordActivatedWebSearch,
          useLearningMode: learningModeActive,
          ...(normalizedCanvasQuestion ? { canvasQuestion: normalizedCanvasQuestion } : {}),
          ...(normalizedChatSessionId ? { chatSessionId: normalizedChatSessionId } : {}),
          messages: completionMessages,
        }),
        signal: controller.signal,
      })
    } catch (error) {
      window.clearTimeout(timeoutId)
      assistantRequestAbortRef.current = null

      if (error instanceof DOMException && error.name === 'AbortError') {
        if (controller.signal.reason === 'manual') {
          return
        }

        clearPendingRequestState()
        setErrorMessage('The assistant took too long to respond. Please try again.')
        return
      }

      throw error
    }

    window.clearTimeout(timeoutId)
    assistantRequestAbortRef.current = null

    if (!response.ok) {
      let message = 'Unable to send message'
      try {
        const errorPayload = (await response.json()) as {
          message?: string
          issues?: Array<{ path?: Array<string | number>; message?: string }>
        }
        if (errorPayload.message) {
          message = errorPayload.message
        }

        const firstIssue = errorPayload.issues?.[0]
        if (firstIssue?.message) {
          const issuePath = Array.isArray(firstIssue.path) ? firstIssue.path.join('.') : ''
          message = issuePath
            ? `${message}: ${issuePath} - ${firstIssue.message}`
            : `${message}: ${firstIssue.message}`
        }
      } catch {
        // Keep fallback error message.
      }

      clearPendingRequestState()
      setErrorMessage(message)
      return
    }

    const payload = (await response.json()) as ChatCompletionResponse
    const resolvedSessionId = payload.chatSessionId ?? chatSessionId
    const generationId = payload.generationId

    if (!generationId) {
      clearPendingRequestState()
      setErrorMessage('Unable to start assistant generation')
      return
    }

    touchSession(resolvedSessionId, payload.sessionTitle)
    setActiveSessionId(resolvedSessionId)

    const generationMessageId = options?.reuseAssistantMessageId ?? `assistant-generation-${generationId}`
    const existingGenerationContent =
      options?.reuseAssistantMessageId
        ? history.find((message) => message.id === options.reuseAssistantMessageId)?.content ?? ''
        : ''
    ensureGenerationMessage(generationMessageId, existingGenerationContent)
    startGenerationPolling(
      generationId,
      resolvedSessionId,
      generationMessageId,
      existingGenerationContent,
      payload.status,
    )
  }

  async function handleCopyMessage(messageId: string, content: string) {
    if (!content.trim()) {
      return
    }

    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)

      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }

      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId(null)
      }, 1800)
    } catch {
      setErrorMessage('Unable to copy response to clipboard')
    }
  }

  async function handleCopyAssistantResponse(message: ChatMessage) {
    const imageUrls = extractAssistantImageUrls(message.content)
    const markdownWithoutImages = stripAssistantImageMarkdown(message.content)
    const parsed = getAssistantRenderableContent(markdownWithoutImages)
    const isImageOnly = imageUrls.length > 0 && parsed.markdown.trim().length === 0 && parsed.charts.length === 0

    if (!isImageOnly) {
      await handleCopyMessage(message.id, getAssistantCopyContent(message.content))
      return
    }

    try {
      await copyAssistantImageToClipboard(imageUrls[0])
      setCopiedMessageId(message.id)

      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }

      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedMessageId(null)
      }, 1800)
    } catch {
      setErrorMessage('Unable to copy image to clipboard')
    }
  }

  function handleStartEditUserMessage(message: ChatMessage) {
    setEditingMessageId(message.id)
    setEditingDraft(message.content)
  }

  function handleCancelEditUserMessage() {
    setEditingMessageId(null)
    setEditingDraft('')
  }

  async function handleSaveEditUserMessage(messageId: string) {
    const nextContent = editingDraft.trim()
    if (!nextContent || isLoading) {
      return
    }

    const editedIndex = messages.findIndex((message) => message.id === messageId)
    if (editedIndex < 0) {
      return
    }

    const updatedHistory = messages.slice(0, editedIndex + 1).map((message) =>
      message.id === messageId
        ? {
            ...message,
            content: nextContent,
          }
        : message,
    )

    setErrorMessage(null)
    setMessages(updatedHistory)
    setEditingMessageId(null)
    setEditingDraft('')

    setIsLoading(true)
    try {
      const sessionId = await ensureActiveSession()
      if (!sessionId) {
        setIsLoading(false)
        return
      }

      await requestAssistantReply(updatedHistory, sessionId)
    } catch {
      setErrorMessage('Network error while contacting chat service')
      setIsLoading(false)
    }
  }

  async function handleRetryAssistantMessage(messageId: string) {
    if (isLoading) {
      return
    }

    const assistantIndex = messages.findIndex((message) => message.id === messageId)
    if (assistantIndex <= 0) {
      return
    }

    const messageToRetry = messages[assistantIndex]
    if (messageToRetry.role !== 'assistant') {
      return
    }

    const historyBeforeAssistant = messages.slice(0, assistantIndex)

    setErrorMessage(null)
    setMessages(historyBeforeAssistant)
    setIsLoading(true)

    try {
      const sessionId = await ensureActiveSession()
      if (!sessionId) {
        setIsLoading(false)
        return
      }

      await requestAssistantReply(historyBeforeAssistant, sessionId)
    } catch {
      setErrorMessage('Network error while contacting chat service')
      setIsLoading(false)
    }
  }

  function handleOpenForkDialog(messageId: string) {
    if (isLoading) {
      return
    }

    setForkTargetMessageId(messageId)
    setForkIntent('alternative')
    setForkTitleDraft('')
    setIsForkDialogOpen(true)
  }

  function closeForkDialog() {
    if (isForkSaving) {
      return
    }

    setIsForkDialogOpen(false)
    setForkTargetMessageId(null)
    setForkTitleDraft('')
    setForkIntent('alternative')
  }

  async function performForkFromMessage(messageId: string, title?: string) {
    if (!activeSessionId) {
      setErrorMessage('Open a chat session before forking.')
      return false
    }

    const token = getSessionToken()
    if (!token) {
      setErrorMessage('Your session has expired. Please sign in again.')
      return false
    }

    const forkIndex = messages.findIndex((message) => message.id === messageId)
    if (forkIndex < 0) {
      setErrorMessage('Unable to determine where to fork this chat.')
      return false
    }

    const response = await fetch(`${apiBaseUrl}/chat/sessions/${activeSessionId}/fork`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messageIndex: forkIndex,
        ...(title ? { title } : {}),
      }),
    })

    if (!response.ok) {
      let message = 'Unable to fork chat session'
      try {
        const payload = (await response.json()) as { message?: string }
        if (payload.message) {
          message = payload.message
        }
      } catch {
        // Keep fallback message.
      }

      setErrorMessage(message)
      return false
    }

    const payload = (await response.json()) as ForkChatSessionResponse
    setChatSessions((previousSessions) => sortSessionsByUpdatedAt([payload.session, ...previousSessions]))
    await openSession(payload.session.id)
    return true
  }

  async function submitForkDialog() {
    if (!forkTargetMessage || isForkSaving || isLoading) {
      return
    }

    const sourceTitle = activeSession?.title ?? 'New chat'
    const forkTitle = buildForkTitle(forkIntent, forkTitleDraft, sourceTitle)

    setIsForkSaving(true)
    try {
      const didFork = await performForkFromMessage(forkTargetMessage.id, forkTitle)
      if (didFork) {
        closeForkDialog()
      }
    } finally {
      setIsForkSaving(false)
    }
  }

  async function loadSessionMessagesForCompare(sessionId: string) {
    const existing = branchComparePayloadBySessionId[sessionId]
    if (existing) {
      return existing
    }

    const token = getSessionToken()
    if (!token) {
      setErrorMessage('Your session has expired. Please sign in again.')
      return null
    }

    const response = await fetch(`${apiBaseUrl}/chat/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      setErrorMessage('Unable to load branch details.')
      return null
    }

    const payload = (await response.json()) as ChatSessionResponse
    setBranchComparePayloadBySessionId((previous) => ({
      ...previous,
      [sessionId]: payload.messages,
    }))
    return payload.messages
  }

  function handleOpenBranchNodeActions(message: ChatMessage) {
    if (message.messageId === undefined) {
      return
    }

    const messageIndex = messages.findIndex((candidate) => candidate.id === message.id)
    if (messageIndex < 0) {
      return
    }

    setBranchNodeDialog({
      messageId: message.id,
      messageDbId: message.messageId,
      messageIndex,
    })
  }

  async function handleCompareBranchAtNode(branchSessionId: string, forkIndex: number) {
    const loaded = await loadSessionMessagesForCompare(branchSessionId)
    if (!loaded) {
      return
    }

    setCompareDialog({
      branchSessionId,
      forkIndex,
    })
  }

  function buildContinuationTextFromUiMessages(list: ChatMessage[], forkIndex: number) {
    return list
      .slice(forkIndex + 1)
      .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'You'}: ${message.content}`)
      .join('\n\n')
      .trim()
  }

  function buildContinuationTextFromApiMessages(list: ChatSessionResponse['messages'], forkIndex: number) {
    return list
      .slice(forkIndex + 1)
      .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'You'}: ${message.content}`)
      .join('\n\n')
      .trim()
  }

  function handleUseComparedBranchResponse() {
    if (!compareDialog) {
      return
    }

    const branchMessages = branchComparePayloadBySessionId[compareDialog.branchSessionId]
    if (!branchMessages) {
      return
    }

    const continuation = buildContinuationTextFromApiMessages(branchMessages, compareDialog.forkIndex)
    if (!continuation) {
      setErrorMessage('No branch continuation is available to merge.')
      return
    }

    setPrompt(`Use this branch continuation as the baseline and continue:\n\n${continuation}`)
    setCompareDialog(null)
    setBranchNodeDialog(null)
  }

  async function handleVisualizationAction(action: ChartAction) {
    if (isLoading) {
      return
    }

    await submitPrompt(action.prompt, [], { silent: true })
  }

  const handleConvertCodeBlockToCanvas = useCallback((payload: { code: string; language: string }) => {
    setCanvasPreviewPayload({
      question: `Canvas from ${payload.language.toUpperCase() || 'code'}`,
      code: convertCodeBlockToCanvasCode(payload.code, payload.language),
    })
    setPreviewPanelWidth(null)
    setIsCanvasPreviewOpen(true)
  }, [])

  async function submitPrompt(nextPrompt?: string, files: File[] = [], options: SubmitPromptOptions = {}) {
    const content = (nextPrompt ?? prompt).trim()
    if (!content || isLoading) {
      return
    }

    const latestCanvasQuestion =
      canvasPreviewPayload?.question ??
      [...messages]
        .reverse()
        .find((message) => message.role === 'assistant' && message.canvasContext?.question)
        ?.canvasContext?.question ??
      null

    const shouldGenerateCanvasResponse = isCanvasModeEnabled || isCanvasPreviewOpen
    const canvasQuestionForRequest = shouldGenerateCanvasResponse
      ? (latestCanvasQuestion ?? content)
      : null
    const canvasTargetMessage =
      shouldGenerateCanvasResponse && latestCanvasMessageId
        ? messages.find((message) => message.id === latestCanvasMessageId && message.role === 'assistant') ?? null
        : null
    const existingCanvasBaseline =
      getCanvasBaselineFromMessage(canvasTargetMessage) ??
      (canvasPreviewPayload
        ? {
            question: canvasPreviewPayload.question,
            code: canvasPreviewPayload.code,
            language: 'html',
          }
        : null)

    if (canvasQuestionForRequest) {
      setQueuedCanvasQuestion(canvasQuestionForRequest)
      canvasQuestionForGenerationRef.current = canvasQuestionForRequest
      canvasGenerationBaselineRef.current =
        existingCanvasBaseline
          ? {
              ...existingCanvasBaseline,
              question: canvasQuestionForRequest,
            }
          : null
    } else {
      canvasQuestionForGenerationRef.current = null
      canvasGenerationBaselineRef.current = null
      setIsCanvasPreviewUpdating(false)
    }

    if (isCanvasPreviewOpen && canvasQuestionForRequest) {
      setIsCanvasPreviewUpdating(true)
    }

    setErrorMessage(null)
    setActiveTopic(null)
    setAiFollowUps([])
    setStreamingMessageId(null)
    resetStream()

    const parsedAttachments = await parseUploadedFiles(files)
    if (parsedAttachments.length > 0 && files.length > 0) {
      await cacheAttachmentPreviewDataUrls(files, parsedAttachments)
    }
    const userMessage = createMessage('user', content, {
      ...(parsedAttachments.length > 0 ? { attachments: parsedAttachments } : {}),
    })
    const history = [...messages, userMessage]

    if (!options.silent) {
      setMessages(history)
      setPrompt('')
    }

    setIsLoading(true)

    try {
      const sessionId = await ensureActiveSession()
      if (!sessionId) {
        setIsLoading(false)
        return
      }

      await requestAssistantReply(history, sessionId, {
        ...(canvasQuestionForRequest ? { canvasQuestion: canvasQuestionForRequest } : {}),
      })
    } catch {
      setErrorMessage('Network error while contacting chat service')
      setIsLoading(false)
      setIsCanvasPreviewUpdating(false)
      canvasQuestionForGenerationRef.current = null
      canvasGenerationBaselineRef.current = null
    }
  }

  function toggleSidebar() {
    if (isMobileLayout) {
      setMobileSidebarOpen((current) => !current)
      return
    }

    setDesktopSidebarOpen((current) => !current)
  }

  function renderBranchTree(parentId: string | null, depth = 0): React.ReactElement | null {
    const key = parentId ?? '__root__'
    const children = (branchTreeChildrenByParent[key] ?? []).slice().sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })

    if (children.length === 0) {
      return null
    }

    return (
      <ul className="space-y-2">
        {children.map((session) => {
          const isActive = session.id === activeSessionId

          return (
            <li key={`tree-${session.id}`}>
              <button
                type="button"
                onClick={() => void openSession(session.id)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${isActive ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                style={{ marginLeft: `${Math.min(depth, 8) * 14}px` }}
              >
                <GitBranch className="size-3.5 shrink-0 text-gray-400" />
                <span className="truncate">{session.title}</span>
              </button>
              <div className="mt-1">{renderBranchTree(session.id, depth + 1)}</div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <main className="lovechat-shell relative flex h-screen overflow-hidden bg-[#F9FAFB] p-0 text-gray-900 transition-colors duration-200 sm:p-2 md:p-3 dark:bg-[#171717] dark:text-gray-100">
      {isMobileLayout && sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px]"
          aria-label="Close sidebar"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <div
        className={isMobileLayout
          ? `fixed inset-y-0 left-0 z-40 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : 'relative z-20'}
      >
        <ChatSidebar
          isOpen={sidebarOpen}
          isMobile={isMobileLayout}
          isSessionsLoading={isSessionsLoading}
          groupedSessions={groupedSessions}
          activeSessionId={activeSessionId}
          avatarInitials={avatarInitials}
          avatarImageSrc={avatarDataUrl}
          profileName={avatarNameSource || 'Your Profile'}
          onToggleSidebar={toggleSidebar}
          onOpenProfile={handleOpenProfile}
          onOpenSettings={handleOpenSettings}
          onLogout={handleLogout}
          onCreateNewChat={async () => {
            await handleCreateNewChat()
            if (isMobileLayout) {
              setMobileSidebarOpen(false)
            }
          }}
          onOpenSession={async (sessionId) => {
            await openSession(sessionId)
            if (isMobileLayout) {
              setMobileSidebarOpen(false)
            }
          }}
          onRenameSession={handleRenameSession}
          onDeleteSessionIntent={setSessionIdPendingDelete}
        />
      </div>

      <div
        ref={splitLayoutRef}
        className={`relative flex min-w-0 flex-1 overflow-hidden md:ml-3 ${isPreviewResizeActive ? 'cursor-col-resize select-none' : ''}`}
      >
        <div
          ref={chatPaneRef}
          className={`relative min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-white shadow-sm transition-all duration-300 md:rounded-[24px] md:border md:border-[#E5E5E5] dark:border-white/10 dark:bg-[#212121] ${isCanvasPreviewOpen ? (previewPanelWidth === null ? 'hidden md:flex md:flex-none md:w-[320px] lg:w-[380px] xl:w-[420px]' : 'hidden md:flex md:flex-1 md:min-w-0') : 'flex'}`}
        >
        <ChatHeader
          chatTitle={activeChatTitle}
          hideChatTitle={isCanvasPreviewOpen && !canShowCenteredHeaderTitle}
          showSidebarToggle={isMobileLayout}
          onToggleSidebar={toggleSidebar}
          onOpenBranchMap={isActiveSessionFork ? () => setIsBranchMapOpen(true) : undefined}
          onCopyLink={handleCopyShareLink}
          onExportPdf={handleExportPdf}
          onExportMarkdown={handleExportMarkdown}
          onRenameChat={() => void handleRenameActiveChat()}
          onClearChat={handleClearActiveChat}
          onDeleteChat={handleDeleteActiveChat}
        />

        <section
          className={`relative flex min-h-0 flex-1 flex-col px-3 pt-16 sm:px-4 ${isCanvasPreviewOpen ? 'pb-0 sm:pb-0' : 'pb-3 sm:pb-4'}`}
        >
        <div className={`flex min-h-0 w-full flex-1 flex-col ${messages.length === 0 ? 'justify-center' : ''}`}>
          {messages.length === 0 ? (
            <div className="mx-auto w-full max-w-3xl">
              <div className="mx-auto mb-5 w-full max-w-5xl text-center sm:mb-8">
                <h1 className="overflow-hidden text-ellipsis whitespace-nowrap text-[26px] leading-tight font-semibold tracking-tight text-black sm:text-[36px] md:text-[44px] dark:text-gray-100">
                  {greetingHeaderParts.beforeName}
                  <span className="lovechat-accent-text">{firstName}</span>
                  {greetingHeaderParts.afterName}
                </h1>
                <h2 className="overflow-hidden text-ellipsis whitespace-nowrap text-[26px] leading-tight font-normal tracking-tight text-black sm:text-[36px] md:text-[44px] dark:text-gray-100">
                  {landingGreeting.subtext}
                </h2>
              </div>

              <ChatInput
                prompt={prompt}
                onPromptChange={setPrompt}
                onSubmit={(files, promptOverride) => void submitPrompt(promptOverride, files)}
                onStop={handleStopAssistantResponse}
                isLoading={isLoading}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                webSearchActive={webSearchActive}
                onWebSearchChange={setWebSearchActive}
                learningModeActive={learningModeActive}
                onLearningModeChange={setLearningModeActive}
                isCanvasMode={isCanvasModeEnabled}
                onCanvasModeChange={setIsCanvasModeEnabled}
                showQuickTemplates={canShowChatQuickTemplates && templateSeedText.length > 0 && hasVerifiableAssistantContext}
                templateSeedText={templateSeedText}
                isCodeContext={isCodeTemplateContext}
                aiFollowUps={aiFollowUps}
                quickTemplateMode="starter"
                autoSendQuickTemplates={false}
              />

              <div className="z-10 mt-4 flex w-full flex-wrap items-center justify-center gap-2 sm:mt-5 sm:gap-3">
                {(Object.keys(suggestionsData) as Topic[]).map((topic) => {
                  const isActive = activeTopic === topic

                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setActiveTopic(topic)}
                      className={`rounded-[12px] border px-3 py-1.5 text-[13px] font-medium transition-colors sm:px-3.5 sm:py-2 sm:text-[14px] ${isActive ? 'lovechat-accent-soft shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--ring)_22%,transparent_78%)]' : 'border-[#E5E5E5] text-slate-900 lovechat-accent-surface dark:text-slate-100'}`}
                    >
                      {topic}
                    </button>
                  )
                })}
              </div>

              {suggestions.length > 0 ? (
                <div className="z-10 mt-4 flex w-full flex-col overflow-hidden rounded-[20px] border border-[#E5E5E5] text-left shadow-[0_2px_12px_rgba(0,0,0,0.02)] sm:mt-6 sm:rounded-[24px]">
                  {visibleSuggestions.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => void submitPrompt(text)}
                      className="lovechat-accent-surface border-b border-[#E5E5E5] bg-white px-4 py-3 text-left text-[14px] text-gray-700 transition-colors last:border-b-0 sm:px-5 sm:py-4 sm:text-[15px]"
                    >
                      {text}
                    </button>
                  ))}

                  {isMobileLayout && hiddenSuggestionCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllMobileSuggestions(true)}
                      className="lovechat-accent-surface bg-white px-4 py-2.5 text-center text-[13px] font-medium text-gray-600 transition-colors"
                    >
                      Show {hiddenSuggestionCount} more
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div
              ref={messageListRef}
              onScroll={handleMessageListScroll}
              className="min-h-0 flex-1 overflow-y-auto pb-44 [&::-webkit-scrollbar-thumb]:rounded-[10px] [&::-webkit-scrollbar-thumb]:bg-[#E5E7EB] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
            >
              <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-start gap-8 pt-8 pb-4">
                {messages.map((message) =>
                  message.role === 'user' ? (
                    <div id={`message-${message.id}`} key={message.id} className="group relative flex w-full flex-col items-end">
                      <div className="flex w-full max-w-[80%] flex-col items-end gap-2.5">
                        {(message.attachments ?? []).length > 0 ? (
                          <div className="w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <div className="ml-auto flex w-max max-w-full items-center gap-2">
                              {(message.attachments ?? []).map((attachment) => {
                                const visual = getAttachmentVisual(attachment)
                                return (
                                  <div
                                    key={attachment.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openAttachmentPreview(attachment)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        openAttachmentPreview(attachment)
                                      }
                                    }}
                                    className="flex w-[min(100%,22rem)] cursor-pointer items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white px-2.5 py-2 shadow-sm transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#2f2f2f] dark:hover:bg-[#343434]"
                                  >
                                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${visual.containerClassName}`}>
                                      <visual.Icon className={`size-3.5 ${visual.iconClassName}`} aria-hidden />
                                    </div>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                      <p className="truncate text-[12px] font-medium text-gray-800 dark:text-gray-100">
                                        {attachment.name}
                                        <span className="ml-1 text-[11px] font-normal text-gray-500 dark:text-gray-400">
                                          • {getAttachmentTypeLabel(attachment)} • {formatFileSize(attachment.size)}
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : null}

                        <div className="lovechat-accent-soft-static rounded-[20px] rounded-tr-[4px] px-5 py-3.5 text-[15px] leading-relaxed shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                        {editingMessageId === message.id ? (
                          <div className="flex min-w-[280px] flex-col gap-3 sm:min-w-[400px]">
                            <textarea
                              value={editingDraft}
                              onChange={(event) => setEditingDraft(event.target.value)}
                              rows={3}
                              className="lovechat-accent-focus w-full resize-none rounded-xl border border-[#E5E5E5] bg-white p-3 text-[15px] text-gray-900 outline-none shadow-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditUserMessage}
                                className="lovechat-accent-surface rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-1.5 text-[13px] font-medium text-gray-700 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSaveEditUserMessage(message.id)}
                                disabled={isLoading}
                                className="lovechat-accent-button rounded-[8px] px-4 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        )}
                        </div>
                      </div>

                      {editingMessageId !== message.id ? (
                        <div className="mt-1.5 flex items-center gap-2 px-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleStartEditUserMessage(message)}
                            className="p-1 text-gray-400 transition-colors hover:text-gray-600"
                            aria-label="Edit message"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(message.id, message.content)}
                            className={`p-1 transition-colors ${copiedMessageId === message.id ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'}`}
                            aria-label="Copy message"
                            title="Copy"
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenForkDialog(message.id)}
                            className="p-1 text-gray-400 transition-colors hover:text-gray-600"
                            aria-label="Fork chat from here"
                            title="Fork chat from here"
                            disabled={isLoading}
                          >
                            <GitBranch className="size-3.5" />
                          </button>

                          {message.messageId !== undefined &&
                          (branchesByForkMessageId[message.messageId]?.length ?? 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenBranchNodeActions(message)}
                              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                              aria-label="Open branches from this point"
                              title="Switch or compare branches"
                            >
                              {branchesByForkMessageId[message.messageId]?.length} branch{(branchesByForkMessageId[message.messageId]?.length ?? 0) === 1 ? '' : 'es'}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div id={`message-${message.id}`} key={message.id} className="group w-full max-w-[90%]">
                      <div className="pt-1 text-[15px] leading-relaxed text-gray-800">
                        {(() => {
                          const renderedContent =
                            streamingMessageId === message.id
                              ? (stream || message.content)
                              : message.content
                          const resolvedCanvasContext =
                            message.canvasContext ??
                            (activeCanvasContext?.messageId === message.id
                              ? { question: activeCanvasContext.question }
                              : null)
                          const isCanvasMessage = resolvedCanvasContext !== null
                          const imageUrls = extractAssistantImageUrls(renderedContent)
                          const markdownWithoutImages = stripAssistantImageMarkdown(renderedContent)
                          const canvasParts = isCanvasMessage
                            ? extractCanvasStreamParts(markdownWithoutImages)
                            : { code: '', markdownWithoutCode: markdownWithoutImages }
                          const canvasCode = canvasParts.code
                          const markdownForRender = canvasParts.markdownWithoutCode
                          const parsedContent = getAssistantRenderableContent(markdownForRender)
                          const hasRenderableContent = parsedContent.markdown.trim().length > 0 || imageUrls.length > 0
                          const hasVisualizations = parsedContent.charts.length > 0
                          const hasCitations = Boolean(message.citations && message.citations.length > 0)
                          const showActions = hasRenderableContent || hasCitations || hasVisualizations
                          const shouldRenderCanvasBlock = isCanvasMessage && canvasCode.length > 0

                          return (
                            <>
                        {hasRenderableContent ? (
                          <div data-export-assistant-markdown>
                            <Markdown
                              className="prose-p:my-3 first:prose-p:mt-0 last:prose-p:mb-0"
                              onConvertToCanvas={handleConvertCodeBlockToCanvas}
                            >
                              {parsedContent.markdown}
                            </Markdown>
                          </div>
                        ) : null}

                        {shouldRenderCanvasBlock ? (
                          <div className="mt-4">
                            <CanvasCodeBlock
                              question={resolvedCanvasContext?.question ?? 'Canvas'}
                              code={canvasCode}
                              onPreview={() => {
                                setCanvasPreviewPayload({
                                  question: resolvedCanvasContext?.question ?? 'Canvas',
                                  code: canvasCode || defaultCanvasCode,
                                })
                                setPreviewPanelWidth(null)
                                setIsCanvasPreviewOpen(true)
                              }}
                            />
                          </div>
                        ) : null}

                        {imageUrls.length > 0
                          ? imageUrls.map((url, index) => (
                              <div
                                key={`${message.id}-image-${index}`}
                                className="group/img relative w-full max-w-lg overflow-hidden rounded-[20px] border border-[#E5E5E5] bg-gray-50 shadow-sm dark:border-gray-700 dark:bg-[#2f2f2f]"
                              >
                                <img
                                  src={url}
                                  alt={`Generated image ${index + 1}`}
                                  className="aspect-video h-auto w-full object-cover transition-transform duration-700 group-hover/img:scale-105"
                                  loading="lazy"
                                />

                                <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity duration-200 group-hover/img:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => void downloadAssistantImage(url)}
                                    aria-label="Download image"
                                    title="Download"
                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-gray-800 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-black focus:outline-none dark:bg-black/60 dark:text-gray-200 dark:hover:bg-black/80 dark:hover:text-white"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                      <polyline points="7 10 12 15 17 10" />
                                      <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))
                          : null}

                        {hasVisualizations
                          ? parsedContent.charts.map((chart) => (
                              <ChartCard
                                key={`${message.id}-${chart.title}-${chart.xAxis.label}`}
                                chart={chart}
                                onAction={handleVisualizationAction}
                                actionsDisabled={isLoading}
                              />
                            ))
                          : null}

                        {showActions ? (
                          <div className="mt-2 flex items-center gap-2 opacity-100 transition-opacity duration-200">
                          {hasCitations ? (
                            <CitationList
                              id={`assistant-citations-${message.id}`}
                              citations={message.citations ?? []}
                              variant="stacked"
                              className="mr-1"
                            />
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void handleCopyAssistantResponse(message)}
                            className={`p-1 transition-colors ${copiedMessageId === message.id ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'}`}
                            aria-label="Copy response"
                            title="Copy"
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleRetryAssistantMessage(message.id)}
                            className="p-1 text-gray-400 transition-colors hover:text-gray-600"
                            aria-label="Retry response"
                            title="Retry"
                            disabled={isLoading}
                          >
                            <RotateCcw className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleRememberAssistantMessage(message)}
                            className={`p-1 transition-colors ${recentlyRememberedMessageId === message.id ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'}`}
                            aria-label="Add response to memory"
                            title="Add to memory"
                            disabled={isLoading}
                          >
                            {recentlyRememberedMessageId === message.id ? (
                              <Check className="size-3.5" />
                            ) : (
                              <BookMarked className="size-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenForkDialog(message.id)}
                            className="p-1 text-gray-400 transition-colors hover:text-gray-600"
                            aria-label="Fork chat from here"
                            title="Fork chat from here"
                            disabled={isLoading}
                          >
                            <GitBranch className="size-3.5" />
                          </button>

                          {message.messageId !== undefined &&
                          (branchesByForkMessageId[message.messageId]?.length ?? 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenBranchNodeActions(message)}
                              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                              aria-label="Open branches from this point"
                              title="Switch or compare branches"
                            >
                              {branchesByForkMessageId[message.messageId]?.length} branch{(branchesByForkMessageId[message.messageId]?.length ?? 0) === 1 ? '' : 'es'}
                            </button>
                          ) : null}
                          </div>
                        ) : null}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  ),
                )}

                {isLoading && showThinking && activeStreamingContent.trim().length === 0 ? (
                  <AIThinking
                    className="w-full max-w-[90%] pt-1"
                    text={isImageGenerationThinking ? "I'm working on that for you right now..." : thinkingText}
                    variant={isImageGenerationThinking ? 'image-generating' : 'thinking'}
                  />
                ) : null}
              </div>
            </div>
          )}

          {errorMessage ? (
            <div className="mx-auto mb-3 w-full max-w-3xl">
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                {errorMessage}
              </div>
            </div>
          ) : null}

          {messages.length > 0 ? (
            <div
              className={`pointer-events-none absolute bottom-0 z-30 ${isCanvasPreviewOpen ? 'pt-0 pb-0 -left-px -right-px' : 'inset-x-0 pb-1 pt-2'}`}
            >
              {showScrollToBottom ? (
                <div className="mb-2 flex justify-center px-2">
                  <button
                    type="button"
                    onClick={handleScrollToBottom}
                    className="lovechat-accent-button pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full p-0 shadow-md transition-all hover:opacity-90"
                    aria-label="Scroll to latest message"
                    title="Jump to bottom"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
              ) : null}

              <div className={isCanvasPreviewOpen ? 'pb-0 pt-0' : 'pb-1 pt-2'}>
                <div className={isCanvasPreviewOpen ? 'pointer-events-auto w-full' : 'pointer-events-auto mx-auto w-full max-w-3xl'}>
                  <ChatInput
                    prompt={prompt}
                    onPromptChange={setPrompt}
                    onSubmit={(files, promptOverride) => void submitPrompt(promptOverride, files)}
                    onStop={handleStopAssistantResponse}
                    isLoading={isLoading}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    webSearchActive={webSearchActive}
                    onWebSearchChange={setWebSearchActive}
                    learningModeActive={learningModeActive}
                    onLearningModeChange={setLearningModeActive}
                    isCanvasMode={isCanvasModeEnabled}
                    onCanvasModeChange={setIsCanvasModeEnabled}
                    showQuickTemplates={
                      canShowChatQuickTemplates &&
                      !showScrollToBottom &&
                      aiFollowUps.length > 0
                    }
                    templateSeedText={templateSeedText}
                    isCodeContext={isCodeTemplateContext}
                    aiFollowUps={aiFollowUps}
                    quickTemplateMode="follow-up"
                    autoSendQuickTemplates={true}
                    isBottomDocked={isCanvasPreviewOpen}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
        </section>

        {messages.length === 0 ? (
          <footer className="w-full py-4 text-center text-[12px] text-[#9CA3AF] sm:py-6 sm:text-[13px]">
            LoveChat can make mistakes. Check important info
          </footer>
        ) : null}
        </div>

        {canvasPreviewPayload && isCanvasPreviewOpen ? (
          <>
            {!isMobileLayout ? (
              <button
                type="button"
                onMouseDown={(event) => {
                  if (event.button !== 0) {
                    return
                  }

                  event.preventDefault()
                  setIsPreviewResizeActive(true)

                  if (previewPanelWidth === null) {
                    const containerBounds = splitLayoutRef.current?.getBoundingClientRect()
                    if (containerBounds) {
                      const nextWidth = containerBounds.right - event.clientX
                      const maxPreviewWidth = Math.max(previewPanelMinWidthPx, containerBounds.width - chatPanelMinWidthPx)
                      const clampedWidth = Math.min(maxPreviewWidth, Math.max(previewPanelMinWidthPx, nextWidth))
                      setPreviewPanelWidth(clampedWidth)
                    }
                  }
                }}
                className="relative z-30 hidden w-3 shrink-0 cursor-col-resize bg-transparent md:block"
                aria-label="Resize preview panel"
                title="Drag to resize preview"
              />
            ) : null}

            <div
              className={isMobileLayout ? 'contents' : previewPanelWidth === null ? 'flex min-w-0 flex-1' : 'flex min-w-0 shrink-0'}
              style={
                !isMobileLayout && previewPanelWidth !== null
                  ? {
                      width: `${previewPanelWidth}px`,
                      minWidth: `${previewPanelMinWidthPx}px`,
                    }
                  : undefined
              }
            >
              <CanvasPreviewPanel
                question={canvasPreviewPayload.question}
                code={canvasPreviewPayload.code}
                versions={canvasVersionHistory}
                onRestoreVersion={(version) => {
                  setCanvasPreviewPayload({
                    question: version.question,
                    code: version.code,
                  })
                  setIsCanvasPreviewUpdating(false)
                }}
                isUpdating={isCanvasPreviewUpdating}
                isMobileLayout={isMobileLayout}
                onClose={() => {
                  setIsCanvasPreviewOpen(false)
                  setCanvasPreviewPayload(null)
                  setPreviewPanelWidth(null)
                  setIsCanvasPreviewUpdating(false)
                }}
              />
            </div>
          </>
        ) : null}
      </div>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profileFullName={fullName}
        profileNickname={nickname}
        onProfileUpdated={({ fullName: nextFullName, nickname: nextNickname, avatarDataUrl: nextAvatarDataUrl }) => {
          setFullName(nextFullName)
          setNickname(nextNickname)
          setAvatarDataUrl(nextAvatarDataUrl)
        }}
      />

      {isBranchMapOpen ? (
        <div
          className="fixed inset-0 z-[57] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setIsBranchMapOpen(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] border border-[#E5E5E5] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E5E5E5] px-5 py-4">
              <div>
                <h3 className="text-[18px] font-semibold text-gray-900">Conversation Branch Map</h3>
                <p className="text-[13px] text-gray-500">Visual tree of all sessions and branch lineage.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBranchMapOpen(false)}
                className="rounded-md px-2 py-1 text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-4">{renderBranchTree(null)}</div>
          </div>
        </div>
      ) : null}

      {branchNodeDialog ? (
        <div
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setBranchNodeDialog(null)}
        >
          <div
            className="w-full max-w-xl rounded-[20px] border border-[#E5E5E5] bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-[17px] font-semibold text-gray-900">Branches At This Message</h3>
            <p className="mt-1 text-[13px] text-gray-500">
              Switch to a sibling branch or compare branch continuations from this exact node.
            </p>

            <div className="mt-4 space-y-2">
              {(branchesByForkMessageId[branchNodeDialog.messageDbId] ?? []).length === 0 ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-600">
                  No branches were forked from this message yet.
                </p>
              ) : (
                (branchesByForkMessageId[branchNodeDialog.messageDbId] ?? []).map((branch) => (
                  <div
                    key={`branch-node-${branch.id}`}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-[13px] font-medium text-gray-800">{branch.title}</p>
                      <p className="text-[11px] text-gray-500">Updated {new Date(branch.updatedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void openSession(branch.id)
                          setBranchNodeDialog(null)
                        }}
                        className="rounded-md border border-gray-300 px-2 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Switch
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCompareBranchAtNode(branch.id, branchNodeDialog.messageIndex)}
                        className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[12px] font-medium text-blue-800 hover:bg-blue-100"
                      >
                        Compare
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {compareDialog ? (
        <div
          className="fixed inset-0 z-[59] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setCompareDialog(null)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[20px] border border-[#E5E5E5] bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E5E5E5] px-5 py-4">
              <div>
                <h3 className="text-[18px] font-semibold text-gray-900">Compare Branch Continuations</h3>
                <p className="text-[13px] text-gray-500">Side-by-side branch output after this fork point.</p>
              </div>
              <button
                type="button"
                onClick={() => setCompareDialog(null)}
                className="rounded-md px-2 py-1 text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                Close
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
              <div className="min-h-0 overflow-y-auto border-b border-[#E5E5E5] p-4 md:border-r md:border-b-0">
                <p className="mb-2 text-[12px] font-semibold tracking-wide text-gray-500 uppercase">Current Branch</p>
                <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">{buildContinuationTextFromUiMessages(messages, compareDialog.forkIndex) || 'No continuation yet.'}</pre>
              </div>
              <div className="min-h-0 overflow-y-auto p-4">
                <p className="mb-2 text-[12px] font-semibold tracking-wide text-gray-500 uppercase">Selected Branch</p>
                <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-gray-800">{buildContinuationTextFromApiMessages(branchComparePayloadBySessionId[compareDialog.branchSessionId] ?? [], compareDialog.forkIndex) || 'No continuation yet.'}</pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E5E5E5] px-5 py-3">
              <button
                type="button"
                onClick={() => setCompareDialog(null)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
              >
                Keep Comparing
              </button>
              <button
                type="button"
                onClick={handleUseComparedBranchResponse}
                className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-[13px] font-medium text-blue-800 hover:bg-blue-100"
              >
                Use Selected Branch Response
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isForkDialogOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={closeForkDialog}
        >
          <div
            className="w-full max-w-lg rounded-[20px] border border-[#E5E5E5] bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-[18px] font-semibold text-gray-900">Fork Chat From Here</h3>
            <p className="mt-1 text-[13px] text-gray-500">
              Choose an intent label so this branch is easier to understand later.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {(Object.keys(forkIntentLabels) as ForkIntent[]).map((intent) => {
                const isSelected = forkIntent === intent
                return (
                  <button
                    key={`fork-intent-${intent}`}
                    type="button"
                    onClick={() => setForkIntent(intent)}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${isSelected ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    {forkIntentLabels[intent]}
                  </button>
                )
              })}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-[12px] font-medium text-gray-600" htmlFor="fork-title-input">
                Branch title
              </label>
              <input
                id="fork-title-input"
                value={forkTitleDraft}
                onChange={(event) => setForkTitleDraft(event.target.value)}
                placeholder={buildForkTitle(forkIntent, '', activeSession?.title ?? 'New chat')}
                maxLength={120}
                className="w-full rounded-[10px] border border-[#E5E5E5] bg-white px-3 py-2 text-[14px] text-gray-900 outline-none transition-colors focus:border-gray-400"
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeForkDialog}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
                disabled={isForkSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitForkDialog()}
                className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-[13px] font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-60"
                disabled={isForkSaving || !forkTargetMessage}
              >
                {isForkSaving ? 'Creating branch...' : 'Create branch'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sessionIdPendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-[18px] font-semibold text-gray-900">Delete Chat</h3>
            <p className="text-[14px] text-gray-500">
              Are you sure you want to delete this chat? This action cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSessionIdPendingDelete(null)}
                className="rounded-[10px] px-4 py-2 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSession(sessionIdPendingDelete)}
                className="rounded-[10px] bg-red-600 px-4 py-2 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isRenameDialogOpen ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeRenameDialog}
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-1 text-[18px] font-semibold text-gray-900">Rename Chat</h3>
            <p className="mb-4 text-[14px] text-gray-500">
              Choose a new title for this chat session.
            </p>

            <input
              ref={renameInputRef}
              type="text"
              value={renameDialogDraft}
              onChange={(event) => setRenameDialogDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submitRenameDialog()
                }

                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeRenameDialog()
                }
              }}
              className="w-full rounded-[10px] border border-[#E5E5E5] bg-white px-3 py-2 text-[14px] text-gray-900 outline-none transition-colors focus:border-gray-400"
              placeholder="Chat title"
              maxLength={120}
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeRenameDialog}
                className="rounded-[10px] px-4 py-2 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
                disabled={isRenameSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitRenameDialog()}
                className="rounded-[10px] bg-[#E5E5E5] px-4 py-2 text-[14px] font-medium text-[#111827] shadow-sm transition-colors hover:bg-gray-200 disabled:opacity-60"
                disabled={isRenameSaving || !renameDialogDraft.trim()}
              >
                {isRenameSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isClearDialogOpen ? (
        <div
          className="fixed inset-0 z-[54] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={closeClearDialog}
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-1 text-[18px] font-semibold text-gray-900">Clear Chat</h3>
            <p className="text-[14px] text-gray-500">
              Clear all messages in this chat view?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeClearDialog}
                className="rounded-[10px] px-4 py-2 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearDialog}
                className="rounded-[10px] bg-[#E5E5E5] px-4 py-2 text-[14px] font-medium text-[#111827] shadow-sm transition-colors hover:bg-gray-200"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeAttachmentPreview ? (
        <div
          className="fixed inset-0 z-[56] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={closeAttachmentPreview}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[20px] border border-[#E5E5E5] bg-white shadow-xl dark:border-white/10 dark:bg-[#2f2f2f]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E5E5E5] px-4 py-3 dark:border-white/10">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  {activeAttachmentPreview.name}
                </h3>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">
                  {getAttachmentTypeLabel(activeAttachmentPreview)} • {formatFileSize(activeAttachmentPreview.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAttachmentPreview}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                aria-label="Close file preview"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="min-h-[300px] flex-1 overflow-auto bg-[#F9FAFB] p-5 dark:bg-[#202020]">
              {(() => {
                const previewDataUrl = attachmentPreviewDataUrlsRef.current[activeAttachmentPreview.id]
                const isPdfPreview = activeAttachmentPreview.mimeType === 'application/pdf'
                const isTextLikePreview =
                  activeAttachmentPreview.mimeType.startsWith('text/') ||
                  activeAttachmentPreview.mimeType.includes('html')

                if (activeAttachmentPreview.imageDataUrl) {
                  return (
                    <img
                      src={activeAttachmentPreview.imageDataUrl}
                      alt={activeAttachmentPreview.name}
                      className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain shadow-sm"
                    />
                  )
                }

                if (previewDataUrl && (isPdfPreview || isTextLikePreview)) {
                  return (
                    <iframe
                      title={activeAttachmentPreview.name}
                      src={previewDataUrl}
                      className="h-[72vh] w-full rounded-xl border border-[#E5E5E5] bg-white shadow-sm dark:border-white/10 dark:bg-[#242424]"
                    />
                  )
                }

                if (activeAttachmentPreview.textContent) {
                  return (
                    <pre className="h-full min-h-[300px] overflow-auto rounded-xl border border-[#E5E5E5] bg-white p-4 text-[13px] leading-relaxed text-gray-700 whitespace-pre-wrap dark:border-white/10 dark:bg-[#242424] dark:text-gray-200">
                      {activeAttachmentPreview.textContent}
                    </pre>
                  )
                }

                return (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-[#6B7280] dark:text-gray-400">
                    <FileText className="size-10" strokeWidth={1.6} aria-hidden />
                    <p className="text-[14px]">Preview is not available for this file.</p>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export { ChatLanding }
