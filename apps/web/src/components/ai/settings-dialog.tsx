import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'

type SettingsTab = 'general' | 'personalization' | 'data'
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

const TAB_LABELS: Record<SettingsTab, string> = {
  general: 'General',
  personalization: 'Personalization',
  data: 'Data Controls',
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
}

const TABS: SettingsTab[] = ['general', 'personalization', 'data']

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
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [accentColor, setAccentColor] = useState<AccentColor>(getInitialAccentColor)

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
    setProfileError(null)
    setSaveMessage(null)
    setTheme(getInitialTheme())
    setAccentColor(getInitialAccentColor())

    const sessionToken = window.localStorage.getItem('lovechat_session_token')
    if (!sessionToken) {
      return
    }

    let cancelled = false
    setIsProfileLoading(true)
    setIsDataControlsLoading(true)

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

    void loadProfile()
    void loadDataControls()

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
