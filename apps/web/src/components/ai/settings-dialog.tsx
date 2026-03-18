import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  DEFAULT_OLLAMA_URL,
  createDefaultModelSettings,
  fetchOllamaModels,
  getAllConfiguredProviders,
  loadModelSettings,
  saveModelSettings,
  type ModelSettings,
} from '#/components/ai/model-settings'
import { Input } from '#/components/ui/input'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'

type SettingsTab = 'general' | 'personalization' | 'data' | 'models'
type ThemeMode = 'light' | 'dark' | 'auto'
type AccentColor = 'default' | 'blue' | 'violet' | 'pink' | 'rose' | 'green' | 'orange'
type BaseStyleTone = 'default' | 'professional' | 'friendly' | 'candid' | 'quirky' | 'efficient' | 'nerdy' | 'cynical'
type CharacteristicLevel = 'more' | 'default' | 'less'

type SettingsDialogProps = {
  isOpen: boolean
  onClose: () => void
  profileFullName: string
  profileNickname: string
  onProfileUpdated?: (profile: { fullName: string; nickname: string; avatarDataUrl: string | null }) => void
}

type AccountProfileResponse = {
  profile: {
    userId: number
    email: string
    fullName: string
    nickname: string
    avatarDataUrl: string | null
    baseStyleTone: BaseStyleTone
    warmth: CharacteristicLevel
    enthusiasm: CharacteristicLevel
    headers: CharacteristicLevel
    emojis: CharacteristicLevel
    customInstructions: string
    occupation: string
    moreAboutYou: string
  }
}

type DataControlsResponse = {
  dataControls: {
    chatHistoryEnabled: boolean
  }
}

type UserMemory = {
  id: string
  content: string
  source: 'manual' | 'auto'
  createdAt: string
  updatedAt: string
}

type MemoriesResponse = {
  memories: UserMemory[]
}

type MemoryResponse = {
  memory: UserMemory
}

const TAB_LABELS: Record<SettingsTab, string> = {
  general: 'General',
  personalization: 'Personalization',
  data: 'Data Controls',
  models: 'Models',
}

const TAB_ICONS: Record<SettingsTab, React.ReactNode> = {
  general: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  personalization: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  data: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  models: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
}

const TABS: SettingsTab[] = ['general', 'personalization', 'data', 'models']

const ACCENT_COLORS = [
  {
    label: 'Default',
    value: 'default',
    swatchClassName: 'border border-gray-300 bg-gray-700 dark:border-gray-500 dark:bg-gray-300',
    ringClassName: 'ring-gray-400 dark:ring-gray-500',
  },
  { label: 'Blue', value: 'blue', swatchClassName: 'bg-blue-500', ringClassName: 'ring-blue-500' },
  { label: 'Violet', value: 'violet', swatchClassName: 'bg-violet-500', ringClassName: 'ring-violet-500' },
  { label: 'Pink', value: 'pink', swatchClassName: 'bg-pink-500', ringClassName: 'ring-pink-500' },
  { label: 'Rose', value: 'rose', swatchClassName: 'bg-rose-500', ringClassName: 'ring-rose-500' },
  { label: 'Green', value: 'green', swatchClassName: 'bg-emerald-500', ringClassName: 'ring-emerald-500' },
  { label: 'Orange', value: 'orange', swatchClassName: 'bg-orange-500', ringClassName: 'ring-orange-500' },
] as const

const BASE_STYLE_TONE_OPTIONS: Array<{ value: BaseStyleTone; label: string; description: string }> = [
  { value: 'default', label: 'Default', description: 'Helpful, clear, and balanced.' },
  { value: 'professional', label: 'Professional', description: 'Formal and business-like language.' },
  { value: 'friendly', label: 'Friendly', description: 'Warm, casual, and approachable.' },
  { value: 'candid', label: 'Candid', description: 'Direct and straightforward with no sugarcoating.' },
  { value: 'quirky', label: 'Quirky', description: 'Playful voice with creative phrasing.' },
  { value: 'efficient', label: 'Efficient', description: 'Ultra-brief and utility-first responses.' },
  { value: 'nerdy', label: 'Nerdy', description: 'Technical, detailed, and geeky.' },
  { value: 'cynical', label: 'Cynical', description: 'Dry, deadpan, and slightly sarcastic.' },
]

const CHARACTERISTIC_OPTIONS: Array<{ value: CharacteristicLevel; label: string; description: string }> = [
  { value: 'more', label: 'More', description: 'Increase this characteristic in replies.' },
  { value: 'default', label: 'Default', description: 'Keep a neutral, balanced level.' },
  { value: 'less', label: 'Less', description: 'Reduce this characteristic in replies.' },
]

const SUPPORTED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const SUPPORTED_AVATAR_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

function splitFullName(fullName: string) {
  const trimmed = fullName.trim()
  if (!trimmed) {
    return { firstName: '', lastName: '' }
  }

  const [firstName, ...rest] = trimmed.split(/\s+/)
  return {
    firstName,
    lastName: rest.join(' '),
  }
}

function isSupportedAvatarFile(file: File) {
  if (SUPPORTED_AVATAR_MIME_TYPES.has(file.type.toLowerCase())) {
    return true
  }

  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : null
  return extension ? SUPPORTED_AVATAR_EXTENSIONS.has(extension) : false
}

function resolveThemeMode(mode: ThemeMode) {
  if (mode !== 'auto') {
    return mode
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement
  const resolvedMode = resolveThemeMode(mode)

  root.classList.remove('light', 'dark')
  root.classList.add(resolvedMode)

  if (mode === 'auto') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }

  root.style.colorScheme = resolvedMode
  window.localStorage.setItem('theme', mode)
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'auto'
  }

  const storedTheme = window.localStorage.getItem('theme')
  return storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'auto'
    ? storedTheme
    : 'auto'
}

function applyAccentColor(value: AccentColor) {
  if (value === 'default') {
    document.documentElement.removeAttribute('data-accent')
    window.localStorage.removeItem('lovechat_accent_color')
    return
  }

  document.documentElement.setAttribute('data-accent', value)
  window.localStorage.setItem('lovechat_accent_color', value)
}

function getInitialAccentColor(): AccentColor {
  if (typeof window === 'undefined') {
    return 'default'
  }

  const storedAccent = window.localStorage.getItem('lovechat_accent_color')
  return ACCENT_COLORS.some((color) => color.value === storedAccent)
    ? (storedAccent as AccentColor)
    : 'default'
}

function getInitials(firstName: string, lastName: string) {
  const f = firstName.trim().charAt(0)
  const l = lastName.trim().charAt(0)
  return (f + l).toUpperCase() || '?'
}

function SettingsDialog({
  isOpen,
  onClose,
  profileFullName,
  profileNickname,
  onProfileUpdated,
}: SettingsDialogProps) {
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL ?? 'http://localhost:4000', [])
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const [baseStyleTone, setBaseStyleTone] = useState<BaseStyleTone>('default')
  const [warmth, setWarmth] = useState<CharacteristicLevel>('default')
  const [enthusiasm, setEnthusiasm] = useState<CharacteristicLevel>('default')
  const [headers, setHeaders] = useState<CharacteristicLevel>('default')
  const [emojis, setEmojis] = useState<CharacteristicLevel>('default')
  const [customInstructions, setCustomInstructions] = useState('')
  const [occupation, setOccupation] = useState('')
  const [moreAboutYou, setMoreAboutYou] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [chatHistoryEnabled, setChatHistoryEnabled] = useState(true)
  const [isDataControlsLoading, setIsDataControlsLoading] = useState(false)
  const [isSavingDataControls, setIsSavingDataControls] = useState(false)
  const [isExportingData, setIsExportingData] = useState(false)
  const [isDeletingAllChats, setIsDeletingAllChats] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [isDeleteAllChatsDialogOpen, setIsDeleteAllChatsDialogOpen] = useState(false)
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [dataMessage, setDataMessage] = useState<string | null>(null)
  const [memories, setMemories] = useState<UserMemory[]>([])
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [editingMemoryDraft, setEditingMemoryDraft] = useState('')
  const [isMemoryLoading, setIsMemoryLoading] = useState(false)
  const [isMemorySaving, setIsMemorySaving] = useState(false)
  const [memoryError, setMemoryError] = useState<string | null>(null)
  const [memoryMessage, setMemoryMessage] = useState<string | null>(null)
  const [modelSettings, setModelSettings] = useState<ModelSettings>(createDefaultModelSettings)
  const [isFetchingOllamaModels, setIsFetchingOllamaModels] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [modelMessage, setModelMessage] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [accentColor, setAccentColor] = useState<AccentColor>(getInitialAccentColor)
  const configuredProviders = useMemo(() => getAllConfiguredProviders(modelSettings), [modelSettings])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const initialName = splitFullName(profileFullName)
    setActiveTab('general')
    setFirstName(initialName.firstName)
    setLastName(initialName.lastName)
    setNickname(profileNickname.trim() || initialName.firstName)
    setEmail('')
    setAvatarSrc(null)
    setBaseStyleTone('default')
    setWarmth('default')
    setEnthusiasm('default')
    setHeaders('default')
    setEmojis('default')
    setCustomInstructions('')
    setOccupation('')
    setMoreAboutYou('')
    setChatHistoryEnabled(true)
    setDataError(null)
    setDataMessage(null)
    setMemories([])
    setEditingMemoryId(null)
    setEditingMemoryDraft('')
    setMemoryError(null)
    setMemoryMessage(null)
    setProfileError(null)
    setSaveMessage(null)
    setTheme(getInitialTheme())
    setAccentColor(getInitialAccentColor())
    setModelSettings(loadModelSettings())
    setModelError(null)
    setModelMessage(null)

    const sessionToken = window.localStorage.getItem('lovechat_session_token')
    if (!sessionToken) {
      return
    }

    let cancelled = false
    setIsProfileLoading(true)
    setIsDataControlsLoading(true)
    setIsMemoryLoading(true)

    async function loadProfile() {
      try {
        const response = await fetch(`${apiBaseUrl}/account/profile`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        })

        if (!response.ok) {
          let message = 'Unable to load your account details.'
          try {
            const payload = (await response.json()) as { message?: string }
            if (payload.message) {
              message = payload.message
            }
          } catch {
            // Keep fallback message.
          }

          if (!cancelled) {
            setProfileError(message)
          }
          return
        }

        const payload = (await response.json()) as AccountProfileResponse
        if (cancelled) {
          return
        }

        const persistedName = splitFullName(payload.profile.fullName)
        setFirstName(persistedName.firstName)
        setLastName(persistedName.lastName)
        setNickname(payload.profile.nickname || persistedName.firstName)
        setEmail(payload.profile.email)
        setAvatarSrc(payload.profile.avatarDataUrl)
        setBaseStyleTone(payload.profile.baseStyleTone)
        setWarmth(payload.profile.warmth)
        setEnthusiasm(payload.profile.enthusiasm)
        setHeaders(payload.profile.headers)
        setEmojis(payload.profile.emojis)
        setCustomInstructions(payload.profile.customInstructions)
        setOccupation(payload.profile.occupation)
        setMoreAboutYou(payload.profile.moreAboutYou)
        onProfileUpdated?.({
          fullName: payload.profile.fullName,
          nickname: payload.profile.nickname,
          avatarDataUrl: payload.profile.avatarDataUrl,
        })
      } catch {
        if (!cancelled) {
          setProfileError('Unable to reach the backend. Check that the API is running.')
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false)
        }
      }
    }

    async function loadDataControls() {
      try {
        const response = await fetch(`${apiBaseUrl}/account/data-controls`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        })

        if (!response.ok) {
          let message = 'Unable to load data controls.'
          try {
            const payload = (await response.json()) as { message?: string }
            if (payload.message) {
              message = payload.message
            }
          } catch {
            // Keep fallback message.
          }

          if (!cancelled) {
            setDataError(message)
          }
          return
        }

        const payload = (await response.json()) as DataControlsResponse
        if (cancelled) {
          return
        }

        setChatHistoryEnabled(payload.dataControls.chatHistoryEnabled)
      } catch {
        if (!cancelled) {
          setDataError('Unable to reach the backend. Check that the API is running.')
        }
      } finally {
        if (!cancelled) {
          setIsDataControlsLoading(false)
        }
      }
    }

    async function loadMemories() {
      try {
        const response = await fetch(`${apiBaseUrl}/memory`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        })

        if (!response.ok) {
          let message = 'Unable to load memory.'
          try {
            const payload = (await response.json()) as { message?: string }
            if (payload.message) {
              message = payload.message
            }
          } catch {
            // Keep fallback message.
          }

          if (!cancelled) {
            setMemoryError(message)
          }
          return
        }

        const payload = (await response.json()) as MemoriesResponse
        if (cancelled) {
          return
        }

        const sorted = [...(payload.memories ?? [])].sort(
          (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        )
        setMemories(sorted)
      } catch {
        if (!cancelled) {
          setMemoryError('Unable to reach the backend. Check that the API is running.')
        }
      } finally {
        if (!cancelled) {
          setIsMemoryLoading(false)
        }
      }
    }

    void loadProfile()
    void loadDataControls()
    void loadMemories()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, isOpen, profileFullName, profileNickname])

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) {
      return
    }

    if (!isSupportedAvatarFile(file)) {
      setProfileError('Please upload a JPG, PNG, GIF, or WEBP image.')
      input.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Profile photo must be 5 MB or smaller.')
      input.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null
      if (!result) {
        setProfileError('Unable to read the selected image.')
        input.value = ''
        return
      }

      setAvatarSrc(result)
      setProfileError(null)
      setSaveMessage('Photo selected. Click Save changes to apply it.')
      onProfileUpdated?.({
        fullName: [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim() || profileFullName,
        nickname: nickname.trim() || firstName.trim() || profileNickname,
        avatarDataUrl: result,
      })
      input.value = ''
    }

    reader.onerror = () => {
      setProfileError('Unable to read the selected image.')
      input.value = ''
    }

    reader.readAsDataURL(file)
  }

  function handleThemeChange(value: string | null) {
    const nextTheme = (value ?? 'auto') as ThemeMode
    setTheme(nextTheme)
    applyThemeMode(nextTheme)
  }

  function handleAccentColorChange(value: AccentColor) {
    setAccentColor(value)
    applyAccentColor(value)
  }

  function updateModelSettings(nextSettings: ModelSettings) {
    setModelSettings(nextSettings)
    saveModelSettings(nextSettings)
  }

  function handleModelVisibilityChange(modelKey: string, isVisible: boolean) {
    updateModelSettings({
      ...modelSettings,
      visibility: {
        ...modelSettings.visibility,
        [modelKey]: isVisible,
      },
    })
    setModelError(null)
    setModelMessage('Model visibility updated.')
  }

  function handleOllamaEnabledChange(enabled: boolean) {
    updateModelSettings({
      ...modelSettings,
      ollama: {
        ...modelSettings.ollama,
        enabled,
      },
    })
    setModelError(null)
    setModelMessage(enabled ? 'Local models enabled.' : 'Local models disabled.')
  }

  function handleOllamaUrlChange(url: string) {
    updateModelSettings({
      ...modelSettings,
      ollama: {
        ...modelSettings.ollama,
        url,
      },
    })
    setModelError(null)
    setModelMessage(null)
  }

  async function handleFetchOllamaModels() {
    const ollamaUrl = modelSettings.ollama.url.trim() || DEFAULT_OLLAMA_URL
    setIsFetchingOllamaModels(true)
    setModelError(null)
    setModelMessage(null)

    try {
      const models = await fetchOllamaModels(ollamaUrl)

      const nextVisibility = { ...modelSettings.visibility }
      for (const model of models) {
        if (nextVisibility[model.key] === undefined) {
          nextVisibility[model.key] = true
        }
      }

      updateModelSettings({
        ...modelSettings,
        visibility: nextVisibility,
        ollama: {
          ...modelSettings.ollama,
          enabled: true,
          url: ollamaUrl,
          models,
          lastSyncedAt: Date.now(),
        },
      })

      setModelMessage(models.length === 0 ? 'Connected to Ollama, but no models were found.' : `Fetched ${models.length} local model${models.length === 1 ? '' : 's'} from Ollama.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect to Ollama.'
      setModelError(message)
    } finally {
      setIsFetchingOllamaModels(false)
    }
  }

  async function handleChatHistoryToggle(nextValue: boolean) {
    const sessionToken = window.localStorage.getItem('lovechat_session_token')
    if (!sessionToken) {
      setDataError('Your session has expired. Please sign in again.')
      setDataMessage(null)
      return
    }

    setIsSavingDataControls(true)
    setDataError(null)
    setDataMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/account/data-controls`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          chatHistoryEnabled: nextValue,
        }),
      })

      const payload = (await response.json()) as DataControlsResponse & { message?: string }
      if (!response.ok) {
        setDataError(payload.message ?? 'Unable to update chat history setting.')
        return
      }

      setChatHistoryEnabled(payload.dataControls.chatHistoryEnabled)
      setDataMessage('Data controls updated.')
    } catch {
      setDataError('Unable to reach the backend. Check that the API is running.')
    } finally {
      setIsSavingDataControls(false)
    }
  }

  async function handleExportData() {
    const sessionToken = window.localStorage.getItem('lovechat_session_token')
    if (!sessionToken) {
      setDataError('Your session has expired. Please sign in again.')
      setDataMessage(null)
      return
    }

    setIsExportingData(true)
    setDataError(null)
    setDataMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/account/export`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      })

      const payload = (await response.json()) as { message?: string }
      if (!response.ok) {
        setDataError(payload.message ?? 'Unable to export data.')
        return
      }

      const jsonText = JSON.stringify(payload, null, 2)
      const blob = new Blob([jsonText], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `lovechat-export-${new Date().toISOString().slice(0, 10)}.json`
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setDataMessage('Data export downloaded.')
    } catch {
      setDataError('Unable to reach the backend. Check that the API is running.')
    } finally {
      setIsExportingData(false)
    }
  }

  async function handleDeleteAllChats() {
    const sessionToken = window.localStorage.getItem('lovechat_session_token')
    if (!sessionToken) {
      setDataError('Your session has expired. Please sign in again.')
      setDataMessage(null)
      return
    }

    setIsDeletingAllChats(true)
    setDataError(null)
    setDataMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/chat/sessions`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      })

      const payload = (await response.json()) as { deletedCount?: number; message?: string }
      if (!response.ok) {
        setDataError(payload.message ?? 'Unable to delete all chats.')
        return
      }

      const deletedCount = payload.deletedCount ?? 0
      setIsDeleteAllChatsDialogOpen(false)
      setDataMessage(`Deleted ${deletedCount} chat${deletedCount === 1 ? '' : 's'}. Refreshing chat...`)
      window.setTimeout(() => {
        window.location.reload()
      }, 350)
    } catch {
      setDataError('Unable to reach the backend. Check that the API is running.')
    } finally {
      setIsDeletingAllChats(false)
    }
  }

  async function handleDeleteAccount() {
    const sessionToken = window.localStorage.getItem('lovechat_session_token')
    if (!sessionToken) {
      setDataError('Your session has expired. Please sign in again.')
      setDataMessage(null)
      return
    }

    setIsDeletingAccount(true)
    setDataError(null)
    setDataMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      })

      if (!response.ok) {
        let message = 'Unable to delete account.'
        try {
          const payload = (await response.json()) as { message?: string }
          if (payload.message) {
            message = payload.message
          }
        } catch {
          // Keep fallback message.
        }

        setDataError(message)
        return
      }

      setIsDeleteAccountDialogOpen(false)
      window.localStorage.removeItem('lovechat_session_token')
      window.localStorage.removeItem('lovechat_onboarding_profile')
      window.location.assign('/sign-in')
    } catch {
      setDataError('Unable to reach the backend. Check that the API is running.')
    } finally {
      setIsDeletingAccount(false)
    }
  }

  async function handleUpdateMemory(memoryId: string) {
    const sessionToken = window.localStorage.getItem('lovechat_session_token')
    if (!sessionToken) {
      setMemoryError('Your session has expired. Please sign in again.')
      setMemoryMessage(null)
      return
    }

    const content = editingMemoryDraft.trim()
    if (!content) {
      return
    }

    setIsMemorySaving(true)
    setMemoryError(null)
    setMemoryMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/memory/${memoryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ content }),
      })

      const payload = (await response.json()) as MemoryResponse & { message?: string }
      if (!response.ok) {
        setMemoryError(payload.message ?? 'Unable to update memory.')
        return
      }

      const next = memories.map((memory) => (memory.id === payload.memory.id ? payload.memory : memory))
      next.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      setMemories(next)
      setEditingMemoryId(null)
      setEditingMemoryDraft('')
      setMemoryMessage('Memory updated.')
    } catch {
      setMemoryError('Unable to reach the backend. Check that the API is running.')
    } finally {
      setIsMemorySaving(false)
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    const sessionToken = window.localStorage.getItem('lovechat_session_token')
    if (!sessionToken) {
      setMemoryError('Your session has expired. Please sign in again.')
      setMemoryMessage(null)
      return
    }

    setIsMemorySaving(true)
    setMemoryError(null)
    setMemoryMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/memory/${memoryId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      })

      if (!response.ok && response.status !== 404) {
        let message = 'Unable to delete memory.'
        try {
          const payload = (await response.json()) as { message?: string }
          if (payload.message) {
            message = payload.message
          }
        } catch {
          // Keep fallback message.
        }

        setMemoryError(message)
        return
      }

      setMemories((previous) => previous.filter((memory) => memory.id !== memoryId))
      if (editingMemoryId === memoryId) {
        setEditingMemoryId(null)
        setEditingMemoryDraft('')
      }
      setMemoryMessage('Memory deleted.')
    } catch {
      setMemoryError('Unable to reach the backend. Check that the API is running.')
    } finally {
      setIsMemorySaving(false)
    }
  }

  async function handleSaveProfile() {
    const sessionToken = window.localStorage.getItem('lovechat_session_token')
    if (!sessionToken) {
      setProfileError('Your session has expired. Please sign in again.')
      setSaveMessage(null)
      return
    }

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const nextFullName = [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ').trim()
    const nextNickname = nickname.trim() || trimmedFirstName || nextFullName

    if (!nextFullName) {
      setProfileError('Please enter at least a first or last name.')
      setSaveMessage(null)
      return
    }

    if (!trimmedEmail) {
      setProfileError('Please enter an email address.')
      setSaveMessage(null)
      return
    }

    setIsSavingProfile(true)
    setProfileError(null)
    setSaveMessage(null)

    try {
      const response = await fetch(`${apiBaseUrl}/account/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          email: trimmedEmail,
          fullName: nextFullName,
          nickname: nextNickname,
          baseStyleTone,
          warmth,
          enthusiasm,
          headers,
          emojis,
          customInstructions,
          occupation,
          moreAboutYou,
          avatarDataUrl: avatarSrc,
        }),
      })

      const payload = (await response.json()) as AccountProfileResponse & { message?: string }
      if (!response.ok) {
        setProfileError(payload.message ?? 'Unable to save your account details.')
        return
      }

      const persistedName = splitFullName(payload.profile.fullName)
      setFirstName(persistedName.firstName)
      setLastName(persistedName.lastName)
      setNickname(payload.profile.nickname)
      setEmail(payload.profile.email)
      setAvatarSrc(payload.profile.avatarDataUrl)
      setBaseStyleTone(payload.profile.baseStyleTone)
      setWarmth(payload.profile.warmth)
      setEnthusiasm(payload.profile.enthusiasm)
      setHeaders(payload.profile.headers)
      setEmojis(payload.profile.emojis)
      setCustomInstructions(payload.profile.customInstructions)
      setOccupation(payload.profile.occupation)
      setMoreAboutYou(payload.profile.moreAboutYou)
      setSaveMessage('Changes saved.')
      window.localStorage.setItem(
        'lovechat_onboarding_profile',
        JSON.stringify({
          fullName: payload.profile.fullName,
          nickname: payload.profile.nickname,
          avatarDataUrl: payload.profile.avatarDataUrl,
        }),
      )
      onProfileUpdated?.({
        fullName: payload.profile.fullName,
        nickname: payload.profile.nickname,
        avatarDataUrl: payload.profile.avatarDataUrl,
      })
    } catch {
      setProfileError('Unable to reach the backend. Check that the API is running.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-2 backdrop-blur-sm dark:bg-black/60 sm:p-4 md:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="relative flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[20px] border border-transparent bg-white shadow-2xl dark:border-gray-700 dark:bg-[#262626] md:h-[85vh] md:max-h-[700px] md:flex-row md:rounded-[24px]">
        <button
          type="button"
          aria-label="Close settings"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none dark:hover:bg-white/10 dark:hover:text-gray-100 md:top-4 md:right-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="flex w-full shrink-0 flex-col gap-2 border-b border-[#E5E5E5] bg-[#F9FAFB] p-3 dark:border-gray-700 dark:bg-[#2d2d2d] md:w-1/3 md:max-w-[240px] md:gap-1.5 md:overflow-y-auto md:border-r md:border-b-0 md:p-5">
          <h2 className="mb-1 px-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:mb-4 md:px-2">Settings</h2>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:gap-1.5 md:overflow-visible md:px-0 md:pb-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[14px] whitespace-nowrap transition-colors focus:outline-none md:w-full md:py-2.5 ${
                  activeTab === tab
                    ? 'bg-gray-200 font-semibold text-gray-900 dark:bg-[#3a3a3a] dark:text-white'
                    : 'font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#343434]'
                }`}
              >
                {TAB_ICONS[tab]}
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto p-4 sm:p-5 md:p-10">
          {activeTab === 'general' ? (
            <div className="flex flex-col gap-8 md:gap-10">
              <section>
                <h3 className="mb-5 border-b border-[#E5E5E5] pb-3 text-[22px] font-bold text-gray-900 dark:border-gray-700 dark:text-white md:mb-6 md:pb-4">
                  Profile
                </h3>

                <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
                  <div className="relative shrink-0">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-[22px] font-bold text-gray-700 dark:bg-[#333] dark:text-gray-200">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        getInitials(firstName, lastName)
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-800 text-white transition-colors hover:bg-gray-700 dark:border-[#212121] dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
                      aria-label="Change avatar"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                      className="hidden"
                      onClick={(event) => {
                        event.currentTarget.value = ''
                      }}
                      onChange={handleAvatarChange}
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="lovechat-accent-text text-[14px] font-medium transition-colors hover:opacity-80"
                    >
                      Change photo
                    </button>
                    {avatarSrc ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarSrc(null)
                          setSaveMessage(null)
                          onProfileUpdated?.({
                            fullName: [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim() || profileFullName,
                            nickname: nickname.trim() || firstName.trim() || profileNickname,
                            avatarDataUrl: null,
                          })
                        }}
                        className="ml-3 text-[14px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Remove
                      </button>
                    ) : null}
                    <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">JPG, PNG or GIF. Max 5 MB.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {isProfileLoading ? (
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">Loading account details...</p>
                  ) : null}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">First name</label>
                      <Input
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="First name"
                        disabled={isProfileLoading || isSavingProfile}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Last name</label>
                      <Input
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="Last name"
                        disabled={isProfileLoading || isSavingProfile}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Email address</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      disabled={isProfileLoading || isSavingProfile}
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => void handleSaveProfile()}
                    disabled={isSavingProfile || isProfileLoading}
                    className="px-4 text-[14px] shadow-sm hover:opacity-90"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>

                {profileError ? (
                  <p className="mt-3 text-right text-[12px] text-red-600 dark:text-red-400">{profileError}</p>
                ) : null}
                {saveMessage ? (
                  <p className="mt-3 text-right text-[12px] text-emerald-600 dark:text-emerald-400">{saveMessage}</p>
                ) : null}
              </section>

              <div className="h-px w-full bg-[#E5E5E5] dark:bg-gray-700" />

              <section>
                <h3 className="mb-6 text-[18px] font-bold text-gray-900 dark:text-white">Appearance</h3>

                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Theme</div>
                      <div className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">Select how you want LoveChat to look.</div>
                    </div>
                    <Select value={theme} onValueChange={handleThemeChange}>
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue className="capitalize" />
                      </SelectTrigger>
                      <SelectPopup>
                        <SelectItem value="auto">System Default</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectPopup>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Accent color</div>
                      <div className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">Choose a highlight color for the interface.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {ACCENT_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          aria-label={color.label}
                          title={color.label}
                          onClick={() => handleAccentColorChange(color.value)}
                          className={`h-7 w-7 rounded-full transition-all focus:outline-none ${color.swatchClassName} ${
                            accentColor === color.value
                              ? `ring-2 ring-offset-2 ${color.ringClassName} dark:ring-offset-[#212121]`
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'personalization' ? (
            <div>
              <h3 className="mb-6 border-b border-[#E5E5E5] pb-3 text-[22px] font-bold text-gray-900 dark:border-gray-700 dark:text-white md:mb-8 md:pb-4">
                Personalization
              </h3>
              <div className="flex flex-col gap-6">
                <div>
                  <div className="mb-2 text-[15px] font-semibold text-gray-900 dark:text-gray-100">Base Style & Tone</div>
                  <div className="mb-4 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                    Choose the primary voice Leo should use by default.
                  </div>
                  <Select
                    value={baseStyleTone}
                    onValueChange={(value) => setBaseStyleTone((value ?? 'default') as BaseStyleTone)}
                  >
                    <SelectTrigger className="w-full max-w-[320px]">
                      <SelectValue className="capitalize" />
                    </SelectTrigger>
                    <SelectPopup>
                      {BASE_STYLE_TONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex flex-col leading-tight">
                            <span>{option.label}</span>
                            <span className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{option.description}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </div>

                <div className="h-px w-full bg-[#E5E5E5] dark:bg-gray-700" />

                <div>
                  <div className="mb-4 text-[15px] font-semibold text-gray-900 dark:text-gray-100">Characteristics</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Warm</label>
                      <Select value={warmth} onValueChange={(value) => setWarmth((value ?? 'default') as CharacteristicLevel)}>
                        <SelectTrigger>
                          <SelectValue className="capitalize" />
                        </SelectTrigger>
                        <SelectPopup>
                          {CHARACTERISTIC_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex flex-col leading-tight">
                                <span>{option.label}</span>
                                <span className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{option.description}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Enthusiastic</label>
                      <Select
                        value={enthusiasm}
                        onValueChange={(value) => setEnthusiasm((value ?? 'default') as CharacteristicLevel)}
                      >
                        <SelectTrigger>
                          <SelectValue className="capitalize" />
                        </SelectTrigger>
                        <SelectPopup>
                          {CHARACTERISTIC_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex flex-col leading-tight">
                                <span>{option.label}</span>
                                <span className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{option.description}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Headers & Formatting</label>
                      <Select value={headers} onValueChange={(value) => setHeaders((value ?? 'default') as CharacteristicLevel)}>
                        <SelectTrigger>
                          <SelectValue className="capitalize" />
                        </SelectTrigger>
                        <SelectPopup>
                          {CHARACTERISTIC_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex flex-col leading-tight">
                                <span>{option.label}</span>
                                <span className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{option.description}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Emojis</label>
                      <Select value={emojis} onValueChange={(value) => setEmojis((value ?? 'default') as CharacteristicLevel)}>
                        <SelectTrigger>
                          <SelectValue className="capitalize" />
                        </SelectTrigger>
                        <SelectPopup>
                          {CHARACTERISTIC_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <span className="flex flex-col leading-tight">
                                <span>{option.label}</span>
                                <span className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{option.description}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-[#E5E5E5] dark:bg-gray-700" />

                <div>
                  <div className="mb-2 text-[15px] font-semibold text-gray-900 dark:text-gray-100">Custom Instructions</div>
                  <div className="mb-4 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                    Add strict behavior instructions for Leo.
                  </div>
                  <textarea
                    rows={4}
                    value={customInstructions}
                    onChange={(event) => setCustomInstructions(event.target.value)}
                    placeholder="Enter custom instructions..."
                    disabled={isProfileLoading || isSavingProfile}
                    className="lovechat-accent-focus w-full resize-none rounded-[12px] border border-[#E5E5E5] bg-[#F9FAFB] p-3 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-gray-100"
                  />
                </div>

                <div className="h-px w-full bg-[#E5E5E5] dark:bg-gray-700" />

                <div>
                  <div className="mb-4 text-[15px] font-semibold text-gray-900 dark:text-gray-100">About You</div>
                  <div className="grid gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Nickname</label>
                      <Input
                        value={nickname}
                        onChange={(event) => setNickname(event.target.value)}
                        placeholder="Your nickname"
                        disabled={isProfileLoading || isSavingProfile}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Occupation</label>
                      <Input
                        value={occupation}
                        onChange={(event) => setOccupation(event.target.value)}
                        placeholder="e.g., Product Designer"
                        disabled={isProfileLoading || isSavingProfile}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">More About You</label>
                      <textarea
                        rows={4}
                        value={moreAboutYou}
                        onChange={(event) => setMoreAboutYou(event.target.value)}
                        placeholder="Share helpful context about your background, goals, or preferences."
                        disabled={isProfileLoading || isSavingProfile}
                        className="lovechat-accent-focus w-full resize-none rounded-[12px] border border-[#E5E5E5] bg-[#F9FAFB] p-3 text-[14px] text-gray-900 placeholder:text-gray-400 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-gray-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => void handleSaveProfile()}
                    disabled={isSavingProfile || isProfileLoading}
                    className="px-4 text-[14px] shadow-sm hover:opacity-90"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save personalization'}
                  </Button>
                </div>

                {profileError ? (
                  <p className="text-right text-[12px] text-red-600 dark:text-red-400">{profileError}</p>
                ) : null}
                {saveMessage ? (
                  <p className="text-right text-[12px] text-emerald-600 dark:text-emerald-400">{saveMessage}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'data' ? (
            <div>
              <h3 className="mb-6 border-b border-[#E5E5E5] pb-3 text-[22px] font-bold text-gray-900 dark:border-gray-700 dark:text-white md:mb-8 md:pb-4">
                Data Controls
              </h3>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="pr-0 sm:pr-8">
                    <div className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Chat History</div>
                    <div className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                      Save new chats to your history. Unsaved chats will be deleted from our systems within 30 days.
                    </div>
                  </div>
                  <Switch
                    checked={chatHistoryEnabled}
                    onCheckedChange={(checked) => {
                      void handleChatHistoryToggle(checked)
                    }}
                    disabled={isDataControlsLoading || isSavingDataControls || isDeletingAccount}
                    aria-label="Chat History"
                    className="data-unchecked:bg-gray-300 dark:data-unchecked:bg-gray-600"
                  />
                </div>

                <div className="h-px w-full bg-[#E5E5E5] dark:bg-gray-700" />

                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Memory</div>
                    <div className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">
                      Review and edit long-term facts and preferences used across future chats.
                    </div>
                  </div>

                  {isMemoryLoading ? (
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">Loading memory...</p>
                  ) : memories.length === 0 ? (
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">No saved memory yet.</p>
                  ) : (
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {memories.map((memory) => {
                        const isEditing = editingMemoryId === memory.id

                        return (
                          <div
                            key={memory.id}
                            className="rounded-xl border border-[#E5E5E5] bg-white p-3 dark:border-gray-700 dark:bg-[#2a2a2a]"
                          >
                            {isEditing ? (
                              <>
                                <textarea
                                  rows={2}
                                  value={editingMemoryDraft}
                                  onChange={(event) => setEditingMemoryDraft(event.target.value)}
                                  disabled={isMemorySaving || isDeletingAccount}
                                  className="lovechat-accent-focus w-full resize-none rounded-[10px] border border-[#E5E5E5] bg-[#F9FAFB] p-2.5 text-[13px] text-gray-900 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-gray-100"
                                />
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Source: {memory.source === 'manual' ? 'Manual' : 'Auto-detected'}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMemoryId(null)
                                        setEditingMemoryDraft('')
                                      }}
                                      disabled={isMemorySaving || isDeletingAccount}
                                      className="rounded-md px-2 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#3a3a3a]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleUpdateMemory(memory.id)
                                      }}
                                      disabled={isMemorySaving || isDeletingAccount || editingMemoryDraft.trim().length === 0}
                                      className="rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-[#3f3f3f] dark:text-gray-200 dark:hover:bg-[#4a4a4a]"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-[13px] leading-relaxed text-gray-800 dark:text-gray-100">{memory.content}</p>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                    {memory.source === 'manual' ? 'Manual' : 'Auto-detected'}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMemoryId(memory.id)
                                        setEditingMemoryDraft(memory.content)
                                      }}
                                      disabled={isMemorySaving || isDeletingAccount}
                                      className="rounded-md px-2 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-[#3a3a3a]"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleDeleteMemory(memory.id)
                                      }}
                                      disabled={isMemorySaving || isDeletingAccount}
                                      className="rounded-md px-2 py-1 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="h-px w-full bg-[#E5E5E5] dark:bg-gray-700" />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Export Data</div>
                    <div className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">Download a copy of your conversations.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleExportData()
                    }}
                    disabled={isExportingData || isDeletingAccount}
                    className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-2 text-[14px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none dark:border-gray-600 dark:bg-[#3f3f3f] dark:text-gray-200 dark:hover:bg-[#4a4a4a]"
                  >
                    {isExportingData ? 'Exporting...' : 'Export'}
                  </button>
                </div>

                <div className="h-px w-full bg-[#E5E5E5] dark:bg-gray-700" />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Delete All Chats</div>
                    <div className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">Permanently remove all conversation history.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeleteAllChatsDialogOpen(true)
                    }}
                    disabled={isDeletingAllChats || isDeletingAccount}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-[14px] font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/40 dark:bg-[#3f3f3f] dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    {isDeletingAllChats ? 'Deleting...' : 'Delete All Chats'}
                  </button>
                </div>

                <div className="h-px w-full bg-[#E5E5E5] dark:bg-gray-700" />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[15px] font-semibold text-red-600 dark:text-red-400">Delete Account</div>
                    <div className="mt-0.5 text-[13px] text-gray-500 dark:text-gray-400">Permanently delete your account and all data.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeleteAccountDialogOpen(true)
                    }}
                    disabled={isDeletingAccount}
                    className="rounded-lg bg-red-600 px-4 py-2 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none"
                  >
                    {isDeletingAccount ? 'Deleting...' : 'Delete'}
                  </button>
                </div>

                {dataError ? (
                  <p className="text-right text-[12px] text-red-600 dark:text-red-400">{dataError}</p>
                ) : null}
                {dataMessage ? (
                  <p className="text-right text-[12px] text-emerald-600 dark:text-emerald-400">{dataMessage}</p>
                ) : null}
                {memoryError ? (
                  <p className="text-right text-[12px] text-red-600 dark:text-red-400">{memoryError}</p>
                ) : null}
                {memoryMessage ? (
                  <p className="text-right text-[12px] text-emerald-600 dark:text-emerald-400">{memoryMessage}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'models' ? (
            <div>
              <h3 className="mb-6 border-b border-[#E5E5E5] pb-3 text-[22px] font-bold text-gray-900 dark:border-gray-700 dark:text-white md:mb-8 md:pb-4">
                Models
              </h3>

              <div className="flex flex-col gap-8">
                <section>
                  <div className="mb-1 text-[15px] font-semibold text-gray-900 dark:text-gray-100">Model Visibility</div>
                  <p className="mb-4 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                    Choose which models appear in your model picker.
                  </p>

                  <div className="flex flex-col gap-6">
                    {configuredProviders.map((provider) => (
                      <div key={provider.key}>
                        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase dark:text-gray-500">
                          {provider.key === 'openai' ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 640 640"
                              fill="currentColor"
                              className="shrink-0 text-gray-500 dark:text-gray-400"
                              aria-hidden="true"
                            >
                              <path d="M260.4 249.8L260.4 201.2C260.4 197.1 261.9 194 265.5 192L363.3 135.7C376.6 128 392.5 124.4 408.9 124.4C470.3 124.4 509.3 172 509.3 222.7C509.3 226.3 509.3 230.4 508.8 234.5L407.3 175.1C401.2 171.5 395 171.5 388.9 175.1L260.4 249.8zM488.7 439.2L488.7 323C488.7 315.8 485.6 310.7 479.5 307.1L351 232.4L393 208.3C396.6 206.3 399.7 206.3 403.2 208.3L501 264.7C529.2 281.1 548.1 315.9 548.1 349.7C548.1 388.6 525.1 424.5 488.7 439.3L488.7 439.3zM230.2 336.8L188.2 312.2C184.6 310.2 183.1 307.1 183.1 303L183.1 190.4C183.1 135.6 225.1 94.1 281.9 94.1C303.4 94.1 323.4 101.3 340.3 114.1L239.4 172.5C233.3 176.1 230.2 181.2 230.2 188.4L230.2 336.9L230.2 336.9zM320.6 389L260.4 355.2L260.4 283.5L320.6 249.7L380.8 283.5L380.8 355.2L320.6 389zM359.3 544.7C337.8 544.7 317.8 537.5 300.9 524.7L401.8 466.3C407.9 462.7 411 457.6 411 450.4L411 301.9L453.5 326.5C457.1 328.5 458.6 331.6 458.6 335.7L458.6 448.3C458.6 503.1 416.1 544.6 359.3 544.6L359.3 544.6zM237.8 430.5L140.1 374.2C111.9 357.8 93 323 93 289.2C93 249.8 116.6 214.4 152.9 199.6L152.9 316.3C152.9 323.5 156 328.6 162.1 332.2L290.1 406.4L248.1 430.5C244.5 432.5 241.4 432.5 237.9 430.5zM232.2 514.5C174.3 514.5 131.8 471 131.8 417.2C131.8 413.1 132.3 409 132.8 404.9L233.7 463.3C239.8 466.9 246 466.9 252.1 463.3L380.6 389.1L380.6 437.7C380.6 441.8 379.1 444.9 375.5 446.9L277.7 503.2C264.4 510.9 248.5 514.5 232.1 514.5L232.1 514.5zM359.2 575.4C421.2 575.4 472.9 531.4 484.6 473C541.9 458.1 578.8 404.4 578.8 349.6C578.8 313.8 563.4 278.9 535.8 253.9C538.4 243.1 539.9 232.4 539.9 221.6C539.9 148.4 480.5 93.6 411.9 93.6C398.1 93.6 384.8 95.6 371.5 100.3C348.5 77.8 316.7 63.4 281.9 63.4C219.9 63.4 168.2 107.4 156.5 165.8C99.2 180.6 62.3 234.4 62.3 289.2C62.3 325 77.7 359.9 105.3 384.9C102.7 395.7 101.2 406.4 101.2 417.2C101.2 490.4 160.6 545.2 229.2 545.2C243 545.2 256.3 543.2 269.6 538.5C292.6 561 324.4 575.4 359.2 575.4z" />
                            </svg>
                          ) : null}
                          {provider.key === 'ollama' ? (
                            <svg
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 512 512"
                              className="shrink-0 text-gray-500 dark:text-gray-400"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M168.64 23.253c4.608 1.814 8.768 4.8 12.544 8.747 6.293 6.528 11.605 15.872 15.659 26.944 4.074 11.136 6.72 23.467 7.722 35.84a107.824 107.824 0 0143.712-13.568l1.088-.085c18.56-1.494 36.907 1.856 52.907 10.112a103.091 103.091 0 016.336 3.626c1.067-12.138 3.669-24.192 7.68-35.072 4.053-11.093 9.365-20.416 15.637-26.965a35.628 35.628 0 0112.566-8.747c5.482-2.133 11.306-2.517 16.981-.896 8.555 2.432 15.893 7.851 21.675 15.723 5.29 7.19 9.258 16.405 11.968 27.456 4.906 19.925 5.76 46.144 2.453 77.76l1.131.853.554.406c16.15 12.288 27.392 29.802 33.344 50.133 9.28 31.723 4.608 67.307-11.392 87.211l-.384.448.043.064c8.896 16.256 14.293 33.429 15.445 51.2l.043.64c1.365 22.72-4.267 45.589-17.365 68.053l-.15.213.214.512c10.069 24.683 13.226 49.536 9.344 74.368l-.128.832a13.888 13.888 0 01-15.936 11.435 13.83 13.83 0 01-11.31-10.43 13.828 13.828 0 01-.21-5.399c3.562-22.038.213-44.139-10.24-66.624a13.713 13.713 0 01.853-13.163l.085-.128c12.886-19.712 18.219-39.04 17.067-58.027-.981-16.618-6.933-32.938-17.067-48.49a13.737 13.737 0 013.84-18.902l.192-.128c5.184-3.392 9.963-12.053 12.374-23.893a90.218 90.218 0 00-2.027-42.112c-4.373-14.933-12.373-27.392-23.573-35.904-12.694-9.685-29.504-14.357-50.774-13.013a13.93 13.93 0 01-13.482-7.915c-6.699-14.187-16.47-24.341-28.651-30.635a70.145 70.145 0 00-37.803-7.082c-26.56 2.112-49.984 17.088-56.96 35.968a13.91 13.91 0 01-13.013 9.066c-22.763.043-40.384 5.376-53.269 14.998-11.136 8.32-18.731 19.946-22.742 33.877a86.824 86.824 0 00-1.45 40.235c2.389 11.904 7.061 21.76 12.416 27.072l.17.149c4.523 4.416 5.483 11.307 2.326 16.747-7.68 13.269-13.419 33.045-14.358 52.053-1.066 21.717 3.968 40.576 15.339 54.101l.341.406a13.711 13.711 0 012.027 14.72c-12.288 26.368-16.064 48.042-11.989 65.109a13.91 13.91 0 01-27.072 6.357c-5.184-21.717-1.664-46.592 10.09-74.624l.299-.746-.17-.256a92.574 92.574 0 01-12.758-27.926l-.107-.405a122.965 122.965 0 01-3.776-38.08c.939-19.413 5.931-39.296 13.27-55.253l.256-.555-.043-.043c-6.25-8.917-10.88-20.33-13.44-32.96l-.107-.512a114.176 114.176 0 011.984-53.12c5.59-19.52 16.576-36.288 32.768-48.405 1.28-.96 2.624-1.92 3.968-2.816-3.392-31.851-2.538-58.24 2.39-78.293 2.709-11.051 6.698-20.267 11.989-27.456 5.76-7.851 13.099-13.27 21.653-15.723 5.675-1.621 11.52-1.259 17.003.896v.021zm87.808 193.92c19.968 0 38.4 6.678 52.181 18.24 13.44 11.243 21.44 26.347 21.44 41.387 0 18.944-8.661 33.707-24.17 43.136-13.227 8-30.955 11.883-51.264 11.883-21.526 0-39.915-5.526-53.184-15.659-13.163-10.027-20.544-24.107-20.544-39.36 0-15.083 8.49-30.229 22.528-41.515 14.25-11.456 33.066-18.112 53.013-18.112zm0 19.115a65.498 65.498 0 00-40.875 13.867c-9.834 7.893-15.402 17.813-15.402 26.666 0 9.131 4.48 17.686 13.013 24.192 9.707 7.403 23.979 11.691 41.451 11.691 17.045 0 31.424-3.136 41.216-9.088 9.877-5.973 14.933-14.635 14.933-26.816 0-9.024-5.248-18.987-14.571-26.795-10.325-8.64-24.32-13.717-39.765-13.717zm14.123 25.813l.085.086a7.431 7.431 0 01-1.195 10.453l-6.229 4.907v9.514a7.999 7.999 0 01-8.021 7.958 8.004 8.004 0 01-8.022-7.958v-9.813l-5.781-4.651a7.4 7.4 0 01-1.109-10.453 7.53 7.53 0 0110.538-1.088l4.587 3.669 4.693-3.712a7.533 7.533 0 0110.454 1.088zm-107.52-40.938c10.197 0 18.496 8.32 18.496 18.581a18.564 18.564 0 01-18.518 18.581 18.559 18.559 0 01-18.496-18.56 18.565 18.565 0 015.399-13.129 18.609 18.609 0 0113.119-5.473zm185.728 0c10.24 0 18.517 8.32 18.517 18.581a18.559 18.559 0 01-18.517 18.581 18.56 18.56 0 01-18.496-18.56 18.56 18.56 0 0118.496-18.602zM158.72 49.067l-.064.042a14.06 14.06 0 00-6.08 5.078l-.107.128c-2.944 4.032-5.504 9.962-7.424 17.749-3.626 14.763-4.608 34.795-2.645 59.349 9.173-2.73 19.179-4.437 29.952-5.056l.213-.021.406-.725a69.41 69.41 0 013.157-5.099c2.624-16.448.469-36.096-5.397-52.139-2.859-7.765-6.336-13.866-9.664-17.344a13.403 13.403 0 00-2.283-1.92l-.064-.042zm195.712.853l-.043.021a13.396 13.396 0 00-2.282 1.92c-3.328 3.478-6.827 9.6-9.664 17.366-6.187 16.938-8.256 37.888-4.907 54.869l1.237 2.069.171.299h.64a110.599 110.599 0 0131.275 4.523c1.834-23.979.81-43.584-2.731-58.07-1.92-7.786-4.48-13.717-7.445-17.749l-.086-.128a14.054 14.054 0 00-6.08-5.099h-.085v-.021z"
                                fill="currentColor"
                              />
                            </svg>
                          ) : null}
                          {provider.label}
                        </div>
                        <div className="flex flex-col gap-3">
                          {provider.models.map((model) => {
                            const isVisible = modelSettings.visibility[model.key] ?? true
                            return (
                              <div key={model.key} className="flex items-center justify-between gap-4">
                                <div>
                                  <div className="text-[14px] font-medium text-gray-800 dark:text-gray-200">{model.title}</div>
                                  {model.key.startsWith('ollama:') ? (
                                    <div className="text-[12px] text-gray-500 dark:text-gray-400">{model.key.replace('ollama:', '')}</div>
                                  ) : null}
                                </div>
                                <Switch
                                  checked={isVisible}
                                  onCheckedChange={(checked) => {
                                    handleModelVisibilityChange(model.key, checked)
                                  }}
                                  aria-label={`Toggle ${model.title}`}
                                  className="data-unchecked:bg-gray-300 dark:data-unchecked:bg-gray-600"
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="h-px w-full bg-[#E5E5E5] dark:bg-gray-700" />

                <section>
                  <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                    <span>Local Models</span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      beta
                    </span>
                  </div>
                  <p className="mb-4 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                    Connect to your local Ollama server and include those models in the picker.
                  </p>

                  <div className="flex flex-col gap-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-[14px] font-medium text-gray-800 dark:text-gray-200">Enable Local Models</div>
                      <Switch
                        checked={modelSettings.ollama.enabled}
                        onCheckedChange={handleOllamaEnabledChange}
                        aria-label="Enable local models"
                        className="data-unchecked:bg-gray-300 dark:data-unchecked:bg-gray-600"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Ollama API URL</label>
                      <Input
                        value={modelSettings.ollama.url}
                        onChange={(event) => handleOllamaUrlChange(event.target.value)}
                        placeholder={DEFAULT_OLLAMA_URL}
                        disabled={isFetchingOllamaModels}
                      />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          void handleFetchOllamaModels()
                        }}
                        disabled={isFetchingOllamaModels}
                        className="rounded-[10px] bg-gray-100 px-4 py-2.5 text-[13px] font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#333333] dark:text-gray-200 dark:hover:bg-[#444444]"
                      >
                        {isFetchingOllamaModels ? 'Fetching...' : 'Fetch Local Models'}
                      </button>
                      {modelSettings.ollama.lastSyncedAt ? (
                        <p className="self-center text-[12px] text-gray-500 dark:text-gray-400">
                          Last synced {new Date(modelSettings.ollama.lastSyncedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>

                    {modelSettings.ollama.models.length > 0 ? (
                      <div>
                        <div className="mb-2 text-[12px] font-semibold text-gray-700 dark:text-gray-300">Discovered Local Models</div>
                        <div className="flex flex-wrap gap-2">
                          {modelSettings.ollama.models.map((model) => (
                            <span
                              key={model.key}
                              className="rounded-md border border-[#E5E5E5] px-2 py-1 text-[12px] text-gray-600 dark:border-gray-600 dark:text-gray-300"
                            >
                              {model.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                {modelError ? (
                  <p className="text-right text-[12px] text-red-600 dark:text-red-400">{modelError}</p>
                ) : null}
                {modelMessage ? (
                  <p className="text-right text-[12px] text-emerald-600 dark:text-emerald-400">{modelMessage}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {isDeleteAllChatsDialogOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Confirm delete all chats">
          <div className="w-full max-w-md rounded-2xl border border-[#E5E5E5] bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-[#212121]">
            <h4 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">Delete all chats?</h4>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">
              This will permanently remove your entire chat history. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteAllChatsDialogOpen(false)}
                disabled={isDeletingAllChats}
                className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-2 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-[#3f3f3f] dark:text-gray-200 dark:hover:bg-[#4a4a4a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteAllChats()
                }}
                disabled={isDeletingAllChats}
                className="rounded-lg bg-red-600 px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-red-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingAllChats ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteAccountDialogOpen ? (
        <div className="fixed inset-0 z-[131] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Confirm delete account">
          <div className="w-full max-w-md rounded-2xl border border-[#E5E5E5] bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-[#212121]">
            <h4 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">Delete your account?</h4>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">
              This permanently removes your account, profile, and all chats. This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteAccountDialogOpen(false)}
                disabled={isDeletingAccount}
                className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-2 text-[14px] font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-[#3f3f3f] dark:text-gray-200 dark:hover:bg-[#4a4a4a]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteAccount()
                }}
                disabled={isDeletingAccount}
                className="rounded-lg bg-red-600 px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-red-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { SettingsDialog }
