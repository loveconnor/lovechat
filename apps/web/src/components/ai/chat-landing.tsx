import { useNavigate } from '@tanstack/react-router'
import { Check, Copy, FileText, Pencil, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CitationList } from '#/components/ai/citation'
import { ChatHeader } from '#/components/ai/chat-header'
import { ChatInput } from '#/components/ai/chat-input'
import { ChatSidebar } from '#/components/ai/chat-sidebar'
import { Markdown } from '#/components/ai/markdown'
import AIThinking from '#/components/ai/thinking'
import { safeParseSerializableCitation } from '#/components/ai/citation/schema'
import { useStream } from '#/components/ai/use-stream'
import type { SerializableCitation } from '#/components/ai/citation'

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

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  attachments?: ChatAttachment[]
  citations?: SerializableCitation[]
  searchedWeb?: boolean
}

type OnboardingProfileResponse = {
  profile: {
    fullName: string
    nickname: string
  }
}

type ChatCompletionResponse = {
  message: {
    role: 'assistant'
    content: string
    citations?: unknown
    searchedWeb?: boolean
    thinking?: string | null
  }
  citations?: unknown
  searchedWeb?: boolean
  thinking?: string | null
  chatSessionId?: string
  sessionTitle?: string
}

type ChatSessionSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

type ChatSessionsResponse = {
  sessions: ChatSessionSummary[]
}

type ChatSessionResponse = {
  session: ChatSessionSummary
  messages: Array<{
    role: ChatRole
    content: string
    attachments?: unknown
    citations?: unknown
    searchedWeb?: boolean
  }>
}

const webSearchKeywordPattern = /\b(research|search)\b/i
const assistantRequestTimeoutMs = 45_000
const defaultThinkingText = 'LoveChat is thinking...'
const thinkingRevealDelayMs = 1200
const attachmentTextContentLimit = 20_000
const attachmentImageDataUrlLimit = 6_000_000

const modelOptions = ['gpt-5-mini', 'gpt-5', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini']

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

  if (attachment.mimeType.startsWith('image/')) {
    return 'Image'
  }

  if (attachment.mimeType.startsWith('text/')) {
    return 'Text Document'
  }

  return 'File'
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
      document = await loadingTask.promise
    } catch {
      // Fallback for environments where worker setup fails unexpectedly.
      const loadingTask = pdfjs.getDocument({ data: fileBuffer, disableWorker: true })
      document = await loadingTask.promise
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
      const baseAttachment: ChatAttachment = {
        id: `attachment-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
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
    attachments?: ChatAttachment[]
    citations?: SerializableCitation[]
    searchedWeb?: boolean
  },
): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    ...(metadata?.attachments ? { attachments: metadata.attachments } : {}),
    ...(metadata?.citations ? { citations: metadata.citations } : {}),
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

function ChatLanding() {
  const navigate = useNavigate()
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL ?? 'http://localhost:4000', [])
  const [selectedModel, setSelectedModel] = useState(modelOptions[0])
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [prompt, setPrompt] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isSessionsLoading, setIsSessionsLoading] = useState(true)
  const [sessionIdPendingDelete, setSessionIdPendingDelete] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [webSearchActive, setWebSearchActive] = useState(false)
  const [thinkingText, setThinkingText] = useState(defaultThinkingText)
  const [showThinking, setShowThinking] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)
  const thinkingTimeoutRef = useRef<number | null>(null)
  const { stream, addPart, reset: resetStream } = useStream()

  const suggestions = useMemo(() => {
    if (!activeTopic) {
      return []
    }

    return suggestionsData[activeTopic]
  }, [activeTopic])

  const avatarNameSource = useMemo(() => fullName.trim() || nickname.trim(), [fullName, nickname])
  const avatarInitials = useMemo(() => getInitials(avatarNameSource), [avatarNameSource])
  const firstName = useMemo(() => getFirstName(fullName, nickname), [fullName, nickname])
  const groupedSessions = useMemo(() => {
    return chatSessions.reduce<Record<string, ChatSessionSummary[]>>((accumulator, session) => {
      const bucket = getSessionBucketLabel(session.updatedAt)
      const current = accumulator[bucket] ?? []
      current.push(session)
      accumulator[bucket] = current
      return accumulator
    }, {})
  }, [chatSessions])

  function getSessionToken() {
    return window.localStorage.getItem('lovechat_session_token')
  }

  function sortSessionsByUpdatedAt(list: ChatSessionSummary[]) {
    return [...list].sort((left, right) => {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })
  }

  function materializeMessages(items: ChatSessionResponse['messages']) {
    return items.map((item) => {
      const citations = normalizeCitations(item.citations)
      const attachments = normalizeAttachments(item.attachments)
      return createMessage(item.role, item.content, {
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(citations.length > 0 ? { citations } : {}),
        ...(item.searchedWeb !== undefined ? { searchedWeb: item.searchedWeb } : {}),
      })
    })
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
      setActiveSessionId(null)
      setMessages([])
      setIsSessionsLoading(false)
      return
    }

    const nextActiveId = payload.sessions[0].id
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
    setIsSessionsLoading(false)
  }

  async function openSession(sessionId: string) {
    const token = getSessionToken()
    if (!token || isLoading) {
      return
    }

    setErrorMessage(null)
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
    setActiveTopic(null)
  }

  async function handleCreateNewChat() {
    if (isLoading) {
      return
    }

    setErrorMessage(null)
    const createdSession = await createChatSession()
    if (!createdSession) {
      return
    }

    setChatSessions((previousSessions) => sortSessionsByUpdatedAt([createdSession, ...previousSessions]))
    setActiveSessionId(createdSession.id)
    setMessages([])
    setPrompt('')
    setEditingMessageId(null)
    setEditingDraft('')
    setActiveTopic(null)
    setStreamingMessageId(null)
    resetStream()
  }

  async function handleRenameSession(sessionId: string, nextTitle: string) {
    const token = getSessionToken()
    if (!token) {
      return
    }

    const normalizedTitle = nextTitle.trim()
    if (!normalizedTitle) {
      return
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
      return
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
        const parsed = JSON.parse(cachedProfile) as { fullName?: string; nickname?: string }
        if (parsed.fullName) {
          setFullName(parsed.fullName)
        }
        if (parsed.nickname) {
          setNickname(parsed.nickname)
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

    void loadOnboardingProfile()

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
    if (messages.length === 0) {
      return
    }

    const container = messageListRef.current
    if (!container) {
      return
    }

    container.scrollTop = container.scrollHeight
  }, [messages, isLoading])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current)
      }

      if (thinkingTimeoutRef.current !== null) {
        window.clearTimeout(thinkingTimeoutRef.current)
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

    if (stream && stream === activeMessage.content) {
      setStreamingMessageId(null)
    }
  }, [messages, stream, streamingMessageId])

  function handleLogout() {
    window.localStorage.removeItem('lovechat_session_token')
    window.localStorage.removeItem('lovechat_onboarding_profile')
    void navigate({ to: '/sign-in' })
  }

  function handleOpenProfile() {
    void navigate({ to: '/onboarding' })
  }

  function handleOpenSettings() {
    setErrorMessage('Settings are coming soon.')
  }

  async function requestAssistantReply(history: ChatMessage[], chatSessionId: string) {
    setThinkingText(defaultThinkingText)
    setShowThinking(false)

    if (thinkingTimeoutRef.current !== null) {
      window.clearTimeout(thinkingTimeoutRef.current)
    }

    thinkingTimeoutRef.current = window.setTimeout(() => {
      setShowThinking(true)
    }, thinkingRevealDelayMs)

    const recentHistory = history.slice(-12)
    const token = window.localStorage.getItem('lovechat_session_token')
    const lastUserMessage = [...recentHistory].reverse().find((message) => message.role === 'user')
    const keywordActivatedWebSearch =
      typeof lastUserMessage?.content === 'string' && webSearchKeywordPattern.test(lastUserMessage.content)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      controller.abort()
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
          model: selectedModel,
          useWebSearch: webSearchActive || keywordActivatedWebSearch,
          chatSessionId,
          messages: recentHistory.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.attachments && message.attachments.length > 0 ? { attachments: message.attachments } : {}),
            ...(message.citations ? { citations: message.citations } : {}),
            ...(message.searchedWeb !== undefined ? { searchedWeb: message.searchedWeb } : {}),
          })),
        }),
        signal: controller.signal,
      })
    } catch (error) {
      window.clearTimeout(timeoutId)

      if (error instanceof DOMException && error.name === 'AbortError') {
        setErrorMessage('The assistant took too long to respond. Please try again.')
        return
      }

      throw error
    }

    window.clearTimeout(timeoutId)

    if (!response.ok) {
      let message = 'Unable to send message'
      try {
        const errorPayload = (await response.json()) as { message?: string }
        if (errorPayload.message) {
          message = errorPayload.message
        }
      } catch {
        // Keep fallback error message.
      }

      setErrorMessage(message)
      return
    }

    const payload = (await response.json()) as ChatCompletionResponse
    const modelThinkingText = payload.message.thinking ?? payload.thinking
    if (typeof modelThinkingText === 'string' && modelThinkingText.trim()) {
      setThinkingText(modelThinkingText)
      setShowThinking(true)
    }

    const assistantContent = payload.message.content.trim()
    if (!assistantContent) {
      setErrorMessage('The assistant returned an empty response')
      return
    }

    const citations = normalizeCitations(payload.message.citations ?? payload.citations)
    const searchedWeb = Boolean(payload.message.searchedWeb ?? payload.searchedWeb ?? citations.length > 0)

    const nextAssistantMessage = createMessage('assistant', assistantContent, {
      citations,
      searchedWeb,
    })

    const resolvedSessionId = payload.chatSessionId ?? chatSessionId
    touchSession(resolvedSessionId, payload.sessionTitle)
    setActiveSessionId(resolvedSessionId)

    setMessages((previousMessages) => [
      ...previousMessages,
      nextAssistantMessage,
    ])

    resetStream()
    setStreamingMessageId(nextAssistantMessage.id)
    addPart(assistantContent)
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
        return
      }

      await requestAssistantReply(updatedHistory, sessionId)
    } catch {
      setErrorMessage('Network error while contacting chat service')
    } finally {
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
        return
      }

      await requestAssistantReply(historyBeforeAssistant, sessionId)
    } catch {
      setErrorMessage('Network error while contacting chat service')
    } finally {
      setIsLoading(false)
    }
  }

  async function submitPrompt(nextPrompt?: string, files: File[] = []) {
    const content = (nextPrompt ?? prompt).trim()
    if (!content || isLoading) {
      return
    }

    setErrorMessage(null)
    setActiveTopic(null)
    setStreamingMessageId(null)
    resetStream()

    const parsedAttachments = await parseUploadedFiles(files)
    const userMessage = createMessage('user', content, {
      ...(parsedAttachments.length > 0 ? { attachments: parsedAttachments } : {}),
    })
    const history = [...messages, userMessage]

    setMessages(history)
    setPrompt('')
    setIsLoading(true)

    try {
      const sessionId = await ensureActiveSession()
      if (!sessionId) {
        return
      }

      await requestAssistantReply(history, sessionId)
    } catch {
      setErrorMessage('Network error while contacting chat service')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="lovechat-shell flex h-screen overflow-hidden bg-white text-gray-900">
      <ChatSidebar
        isOpen={sidebarOpen}
        isSessionsLoading={isSessionsLoading}
        chatSessions={chatSessions}
        groupedSessions={groupedSessions}
        activeSessionId={activeSessionId}
        onCreateNewChat={handleCreateNewChat}
        onOpenSession={openSession}
        onRenameSession={handleRenameSession}
        onDeleteSessionIntent={setSessionIdPendingDelete}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <ChatHeader
          avatarInitials={avatarInitials}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
          onOpenProfile={handleOpenProfile}
          onOpenSettings={handleOpenSettings}
          onLogout={handleLogout}
        />

        <section className="flex min-h-0 flex-1 flex-col px-4 pt-16 pb-6">
        <div className={`flex min-h-0 w-full flex-1 flex-col ${messages.length === 0 ? 'justify-center' : ''}`}>
          {messages.length === 0 ? (
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-8 text-center">
                <h1 className="text-[36px] leading-tight font-semibold tracking-tight text-black md:text-[44px]">
                  Good afternoon, {firstName}.
                </h1>
                <h2 className="text-[36px] leading-tight font-normal tracking-tight text-black md:text-[44px]">
                  How can I help you today?
                </h2>
              </div>

              <ChatInput
                prompt={prompt}
                onPromptChange={setPrompt}
                onSubmit={(files) => void submitPrompt(undefined, files)}
                isLoading={isLoading}
                selectedModel={selectedModel}
                modelOptions={modelOptions}
                onModelChange={setSelectedModel}
                webSearchActive={webSearchActive}
                onWebSearchChange={setWebSearchActive}
              />

              <div className="z-10 mt-5 flex w-full flex-wrap items-center justify-center gap-3">
                {(Object.keys(suggestionsData) as Topic[]).map((topic) => {
                  const isActive = activeTopic === topic

                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setActiveTopic(topic)}
                      className={`rounded-[12px] border px-3.5 py-2 text-[14px] font-medium transition-colors ${isActive ? 'border-gray-300 bg-gray-100 text-black' : 'border-[#E5E5E5] text-black hover:bg-gray-50'}`}
                    >
                      {topic}
                    </button>
                  )
                })}
              </div>

              {suggestions.length > 0 ? (
                <div className="z-10 mt-6 flex w-full flex-col overflow-hidden rounded-[24px] border border-[#E5E5E5] text-left shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  {suggestions.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => void submitPrompt(text)}
                      className="border-b border-[#E5E5E5] bg-white px-5 py-4 text-left text-[15px] text-gray-700 transition-colors last:border-b-0 hover:bg-gray-50"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div
              ref={messageListRef}
              className="min-h-0 flex-1 overflow-y-auto pb-28 [&::-webkit-scrollbar-thumb]:rounded-[10px] [&::-webkit-scrollbar-thumb]:bg-[#E5E7EB] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5"
            >
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-8">
                {messages.map((message) =>
                  message.role === 'user' ? (
                    <div key={message.id} className="group relative flex w-full flex-col items-end">
                      <div className="flex w-full max-w-[80%] flex-col items-end gap-2.5">
                        {(message.attachments ?? []).map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex w-64 items-center gap-3.5 self-end rounded-2xl border border-[#E5E5E5] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#2f2f2f]"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300">
                              <FileText className="size-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 overflow-hidden">
                              <p className="truncate text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                                {attachment.name}
                              </p>
                              <p className="truncate text-[12px] text-gray-500 dark:text-gray-400">
                                {getAttachmentTypeLabel(attachment)} • {formatFileSize(attachment.size)}
                              </p>
                            </div>
                          </div>
                        ))}

                        <div className="rounded-[20px] rounded-tr-[4px] bg-[#F3F4F6] px-5 py-3.5 text-[15px] leading-relaxed text-gray-900 dark:bg-[#3f3f3f] dark:text-gray-100">
                        {editingMessageId === message.id ? (
                          <div className="flex min-w-[280px] flex-col gap-3 sm:min-w-[400px]">
                            <textarea
                              value={editingDraft}
                              onChange={(event) => setEditingDraft(event.target.value)}
                              rows={3}
                              className="w-full resize-none rounded-xl border border-[#E5E5E5] bg-white p-3 text-[15px] text-gray-900 outline-none shadow-sm focus:border-gray-400"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleCancelEditUserMessage}
                                className="rounded-[8px] border border-[#E5E5E5] bg-white px-4 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSaveEditUserMessage(message.id)}
                                disabled={isLoading}
                                className="rounded-[8px] bg-black px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-gray-800"
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
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div key={message.id} className="group w-full max-w-[90%]">
                      <div className="pt-1 text-[15px] leading-relaxed text-gray-800">
                        {(() => {
                          const hasCitations = Boolean(message.citations && message.citations.length > 0)

                          return (
                            <>
                        <Markdown className="prose-p:my-3 first:prose-p:mt-0 last:prose-p:mb-0">
                          {streamingMessageId === message.id ? stream : message.content}
                        </Markdown>

                        <div className={`mt-2 flex items-center gap-2 transition-opacity duration-200 ${hasCitations ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
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
                            onClick={() => void handleCopyMessage(message.id, message.content)}
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
                        </div>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  ),
                )}

                {isLoading && showThinking ? (
                  <AIThinking className="w-full max-w-[90%] pt-1" text={thinkingText} />
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
            <div className="sticky bottom-0 z-30 pb-2 pt-3">
              <div className="mx-auto w-full max-w-3xl">
                <ChatInput
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  onSubmit={(files) => void submitPrompt(undefined, files)}
                  isLoading={isLoading}
                  selectedModel={selectedModel}
                  modelOptions={modelOptions}
                  onModelChange={setSelectedModel}
                  webSearchActive={webSearchActive}
                  onWebSearchChange={setWebSearchActive}
                />
              </div>
            </div>
          ) : null}
        </div>
        </section>

        {messages.length === 0 ? (
          <footer className="w-full py-6 text-center text-[13px] text-[#9CA3AF]">
            LoveChat can make mistakes. Check important info
          </footer>
        ) : null}
      </div>

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
    </main>
  )
}

export { ChatLanding }