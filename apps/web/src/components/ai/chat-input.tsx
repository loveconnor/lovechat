import {
  Brain,
  Check,
  Code2,
  FileSearch,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Globe,
  Plus,
  PenLine,
  Square,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ModelSelector } from '#/components/ai/model-selector'

type ChatInputProps = {
  prompt: string
  onPromptChange: (value: string) => void
  onSubmit: (files: File[], promptOverride?: string) => void
  onStop?: () => void
  isLoading?: boolean
  selectedModel: string
  onModelChange: (model: string) => void
  webSearchActive: boolean
  onWebSearchChange: (active: boolean) => void
  learningModeActive: boolean
  onLearningModeChange: (active: boolean) => void
  isCanvasMode?: boolean
  onCanvasModeChange?: (active: boolean) => void
  showQuickTemplates?: boolean
  templateSeedText?: string
  isCodeContext?: boolean
  aiFollowUps?: Array<{ id: string; label: string; prompt: string }>
  quickTemplateMode?: 'starter' | 'follow-up'
  autoSendQuickTemplates?: boolean
  isBottomDocked?: boolean
}

type UploadedFile = {
  id: string
  file: File
}

type SlashCommand = {
  id: 'summarize' | 'rewrite' | 'fix-code'
  label: string
  description: string
  promptPrefix: string
  Icon: React.ComponentType<{ className?: string }>
  iconClassName: string
  iconSurfaceClassName: string
}

type QuickTemplate = {
  id: 'summarize' | 'rewrite' | 'fix-code' | 'next-steps'
  renderKey?: string
  label: string
  prompt: string
  Icon: React.ComponentType<{ className?: string }>
  iconClassName: string
}

const slashCommands: SlashCommand[] = [
  {
    id: 'summarize',
    label: '/summarize',
    description: 'Condense long text or documents',
    promptPrefix: 'Summarize this text:',
    Icon: FileSearch,
    iconClassName: 'text-blue-600 dark:text-blue-300',
    iconSurfaceClassName: 'bg-blue-50 dark:bg-blue-900/30',
  },
  {
    id: 'rewrite',
    label: '/rewrite',
    description: 'Improve tone and clarity',
    promptPrefix: 'Rewrite this to sound better:',
    Icon: PenLine,
    iconClassName: 'text-violet-600 dark:text-violet-300',
    iconSurfaceClassName: 'bg-violet-50 dark:bg-violet-900/30',
  },
  {
    id: 'fix-code',
    label: '/fix-code',
    description: 'Find bugs and optimize syntax',
    promptPrefix: 'Find and fix bugs in this code:',
    Icon: Code2,
    iconClassName: 'text-emerald-600 dark:text-emerald-300',
    iconSurfaceClassName: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
]

const quickTemplateVisuals: Record<QuickTemplate['id'], Pick<QuickTemplate, 'Icon' | 'iconClassName'>> = {
  summarize: {
    Icon: FileSearch,
    iconClassName: 'text-blue-500',
  },
  rewrite: {
    Icon: PenLine,
    iconClassName: 'text-violet-500',
  },
  'fix-code': {
    Icon: Code2,
    iconClassName: 'text-emerald-500',
  },
  'next-steps': {
    Icon: Brain,
    iconClassName: 'text-orange-500',
  },
}

function normalizeSlashQuery(value: string) {
  return value.trim().toLowerCase()
}

function createFileId() {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/png') {
    return 'png'
  }

  if (mimeType === 'image/jpeg') {
    return 'jpg'
  }

  if (mimeType === 'image/webp') {
    return 'webp'
  }

  if (mimeType === 'image/gif') {
    return 'gif'
  }

  if (mimeType === 'image/svg+xml') {
    return 'svg'
  }

  return 'png'
}

function normalizeFileForUpload(file: File) {
  if (file.name.trim()) {
    return file
  }

  if (!file.type.startsWith('image/')) {
    return file
  }

  const extension = extensionFromMimeType(file.type)
  return new File([file], `pasted-image-${Date.now()}.${extension}`, {
    type: file.type,
    lastModified: file.lastModified,
  })
}

function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf'
}

function isTextFile(file: File) {
  return file.type.startsWith('text/')
}

function getFileExtension(fileName: string) {
  const segments = fileName.toLowerCase().split('.')
  return segments.length > 1 ? segments.pop() ?? '' : ''
}

type UploadFileVisual = {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>
  iconClassName: string
}

function getUploadFileVisual(file: File): UploadFileVisual {
  const mimeType = file.type.toLowerCase()
  const extension = getFileExtension(file.name)

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return { Icon: FileText, iconClassName: 'text-red-500 dark:text-red-300' }
  }

  if (
    mimeType.includes('msword') ||
    mimeType.includes('wordprocessingml') ||
    extension === 'doc' ||
    extension === 'docx'
  ) {
    return { Icon: FileText, iconClassName: 'text-blue-600 dark:text-blue-300' }
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
    return { Icon: FileCode2, iconClassName: 'text-blue-500 dark:text-blue-300' }
  }

  if (mimeType.startsWith('image/')) {
    return { Icon: FileImage, iconClassName: 'text-emerald-500 dark:text-emerald-300' }
  }

  if (mimeType.startsWith('audio/')) {
    return { Icon: FileAudio, iconClassName: 'text-fuchsia-500 dark:text-fuchsia-300' }
  }

  if (mimeType.startsWith('video/')) {
    return { Icon: FileVideo, iconClassName: 'text-violet-500 dark:text-violet-300' }
  }

  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    extension === 'csv' ||
    extension === 'xls' ||
    extension === 'xlsx'
  ) {
    return { Icon: FileSpreadsheet, iconClassName: 'text-green-600 dark:text-green-300' }
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
    return { Icon: FileArchive, iconClassName: 'text-amber-500 dark:text-amber-300' }
  }

  return { Icon: FileText, iconClassName: 'text-gray-500 dark:text-gray-400' }
}

function ChatInput({
  prompt,
  onPromptChange,
  onSubmit,
  onStop,
  isLoading = false,
  selectedModel,
  onModelChange,
  webSearchActive,
  onWebSearchChange,
  learningModeActive,
  onLearningModeChange,
  isCanvasMode = false,
  onCanvasModeChange,
  showQuickTemplates = true,
  templateSeedText = '',
  isCodeContext = false,
  aiFollowUps = [],
  quickTemplateMode = 'follow-up',
  autoSendQuickTemplates = true,
  isBottomDocked = false,
}: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [activePreviewFile, setActivePreviewFile] = useState<UploadedFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [textPreview, setTextPreview] = useState<string>('')
  const [textPreviewLoading, setTextPreviewLoading] = useState(false)
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)
  const [activeSlashCommandId, setActiveSlashCommandId] = useState<SlashCommand['id'] | null>(null)
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [highlightedSlashCommandId, setHighlightedSlashCommandId] = useState<SlashCommand['id']>('summarize')
  const toolsMenuRef = useRef<HTMLDivElement | null>(null)
  const activeSlashCommand =
    activeSlashCommandId !== null
      ? slashCommands.find((command) => command.id === activeSlashCommandId) ?? null
      : null
  const normalizedPrompt = prompt.trim()
  const composedPrompt = activeSlashCommand
    ? `${activeSlashCommand.promptPrefix} ${normalizedPrompt}`.trim()
    : normalizedPrompt
  const filteredSlashCommands = slashCommands.filter((command) => {
    if (!slashQuery) {
      return true
    }

    const normalizedQuery = normalizeSlashQuery(slashQuery)
    const searchable = `${command.label} ${command.description} ${command.promptPrefix}`.toLowerCase()
    return searchable.includes(normalizedQuery)
  })
  const isSubmitDisabled = !isLoading && composedPrompt.length === 0 && uploadedFiles.length === 0
  const isStopEnabled = isLoading && typeof onStop === 'function'
  const normalizedTemplateSeed = templateSeedText.trim()
  const templateWordCount = normalizedTemplateSeed.split(/\s+/).filter(Boolean).length
  const hasRichTemplateContext = normalizedTemplateSeed.length >= 18 && templateWordCount >= 3
  const normalizedAiFollowUps = useMemo(() => {
    return aiFollowUps
      .filter((item) => item && item.label?.trim() && item.prompt?.trim())
      .slice(0, 4)
      .map((item, index) => {
        const normalizedId = item.id?.trim().toLowerCase() || `follow-up-${index + 1}`
        const id: QuickTemplate['id'] =
          normalizedId.includes('summar')
            ? 'summarize'
            : normalizedId.includes('rewrite') || normalizedId.includes('reword')
              ? 'rewrite'
              : normalizedId.includes('fix') || normalizedId.includes('code') || normalizedId.includes('debug')
                ? 'fix-code'
                : 'next-steps'

        return {
          id,
          renderKey: `${normalizedId || `follow-up-${index + 1}`}::${item.label.trim()}::${index}`,
          label: item.label.trim(),
          prompt: item.prompt.trim(),
          ...quickTemplateVisuals[id],
        }
      })
  }, [aiFollowUps])

  const hasFollowUpTemplates = normalizedAiFollowUps.length > 0
  const shouldShowTemplates =
    showQuickTemplates &&
    (quickTemplateMode === 'follow-up' ? hasFollowUpTemplates : hasRichTemplateContext) &&
    !isLoading &&
    uploadedFiles.length === 0 &&
    normalizedPrompt.length === 0 &&
    activeSlashCommand === null

  const contextualTemplatePrompt = {
    summarize:
      normalizedTemplateSeed.length > 0
        ? `Follow up on our conversation. Summarize the current state for "${normalizedTemplateSeed}", including what is done, what is pending, and immediate next actions.`
        : 'Follow up on our conversation. Summarize what is done, what is pending, and immediate next actions.',
    rewrite:
      normalizedTemplateSeed.length > 0
        ? `Follow up on this and rewrite it to be clearer, tighter, and ready to send:\n\n${normalizedTemplateSeed}`
        : 'Follow up on this and rewrite it to be clearer, tighter, and ready to send.',
    fixCode:
      normalizedTemplateSeed.length > 0
        ? isCodeContext
          ? `Follow up on this code task. Find likely bugs, propose fixes, and provide the corrected version:\n\n${normalizedTemplateSeed}`
          : `Follow up on this task. If code is involved, identify likely bugs and provide concrete fixes for:\n\n${normalizedTemplateSeed}`
        : 'Follow up on this code task. Find likely bugs, propose fixes, and provide the corrected version.',
    brainstorm:
      normalizedTemplateSeed.length > 0
        ? `Follow up and propose 5 practical next steps for: ${normalizedTemplateSeed}`
        : 'Follow up and propose 5 practical next steps for this conversation.',
  }

  const templateLabels = {
    summarize: quickTemplateMode === 'follow-up' ? 'Follow up: Summarize' : 'Summarize text',
    rewrite: quickTemplateMode === 'follow-up' ? 'Follow up: Rewrite' : 'Rewrite',
    fixCode: quickTemplateMode === 'follow-up' ? 'Follow up: Fix code' : 'Fix code',
    nextSteps: quickTemplateMode === 'follow-up' ? 'Follow up: Next steps' : 'Next steps',
  }

  const quickTemplates = useMemo(() => {
    if (quickTemplateMode === 'follow-up') {
      return normalizedAiFollowUps
    }

    if (!hasRichTemplateContext) {
      return [] as QuickTemplate[]
    }

    const templates: QuickTemplate[] = []
    const hasLongContext = normalizedTemplateSeed.length >= 70 || templateWordCount >= 10

    if (hasLongContext) {
      templates.push({
        id: 'summarize',
        renderKey: 'starter-summarize',
        label: templateLabels.summarize,
        prompt: contextualTemplatePrompt.summarize,
        ...quickTemplateVisuals.summarize,
      })
    }

    if (normalizedTemplateSeed.length >= 30 || templateWordCount >= 5) {
      templates.push({
        id: 'rewrite',
        renderKey: 'starter-rewrite',
        label: templateLabels.rewrite,
        prompt: contextualTemplatePrompt.rewrite,
        ...quickTemplateVisuals.rewrite,
      })
    }

    if (isCodeContext) {
      templates.push({
        id: 'fix-code',
        renderKey: 'starter-fix-code',
        label: templateLabels.fixCode,
        prompt: contextualTemplatePrompt.fixCode,
        ...quickTemplateVisuals['fix-code'],
      })
    }

    templates.push({
      id: 'next-steps',
      renderKey: 'starter-next-steps',
      label: templateLabels.nextSteps,
      prompt: contextualTemplatePrompt.brainstorm,
      ...quickTemplateVisuals['next-steps'],
    })

    return templates.slice(0, 4)
  }, [
    contextualTemplatePrompt.brainstorm,
    contextualTemplatePrompt.fixCode,
    contextualTemplatePrompt.rewrite,
    contextualTemplatePrompt.summarize,
    hasRichTemplateContext,
    normalizedAiFollowUps,
    isCodeContext,
    quickTemplateMode,
    normalizedTemplateSeed.length,
    templateLabels.fixCode,
    templateLabels.nextSteps,
    templateLabels.rewrite,
    templateLabels.summarize,
    templateWordCount,
  ])

  function handleSubmit() {
    if (isLoading) {
      onStop?.()
      return
    }

    if (isSubmitDisabled) {
      return
    }

    const selectedFiles = uploadedFiles.map((item) => item.file)
    onSubmit(selectedFiles, composedPrompt)
    setUploadedFiles([])
    setActivePreviewFile(null)
    setIsSlashMenuOpen(false)
    setSlashQuery('')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && prompt.length === 0 && activeSlashCommandId !== null) {
      event.preventDefault()
      setActiveSlashCommandId(null)
      return
    }

    if (isSlashMenuOpen && filteredSlashCommands.length > 0) {
      const currentIndex = filteredSlashCommands.findIndex((command) => command.id === highlightedSlashCommandId)

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % filteredSlashCommands.length
        setHighlightedSlashCommandId(filteredSlashCommands[nextIndex].id)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const nextIndex = currentIndex < 0
          ? filteredSlashCommands.length - 1
          : (currentIndex - 1 + filteredSlashCommands.length) % filteredSlashCommands.length
        setHighlightedSlashCommandId(filteredSlashCommands[nextIndex].id)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const selected =
          filteredSlashCommands.find((command) => command.id === highlightedSlashCommandId) ??
          filteredSlashCommands[0]
        selectSlashCommand(selected)
        return
      }
    }

    if (event.key === 'Escape' && isSlashMenuOpen) {
      event.preventDefault()
      setIsSlashMenuOpen(false)
      return
    }

    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    handleSubmit()
  }

  function selectSlashCommand(command: SlashCommand) {
    setActiveSlashCommandId(command.id)
    setIsSlashMenuOpen(false)
    setSlashQuery('')
    onPromptChange('')
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  function handleQuickTemplate(template: QuickTemplate) {
    if (isLoading) {
      return
    }

    setActiveSlashCommandId(null)
    setIsSlashMenuOpen(false)
    setSlashQuery('')

    const followUpPrompt = template.prompt

    if (autoSendQuickTemplates) {
      onPromptChange('')
      onSubmit([], followUpPrompt)
      window.requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
      return
    }

    onPromptChange(followUpPrompt)

    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      const length = inputRef.current?.value.length ?? 0
      inputRef.current?.setSelectionRange(length, length)
    })
  }

  function handlePromptChange(value: string) {
    onPromptChange(value)

    if (value.startsWith('/')) {
      const nextQuery = value.slice(1)
      setSlashQuery(nextQuery)
      setIsSlashMenuOpen(true)

      const firstMatch = slashCommands.find((command) => {
        const normalizedQuery = normalizeSlashQuery(nextQuery)
        if (!normalizedQuery) {
          return true
        }

        const searchable = `${command.label} ${command.description} ${command.promptPrefix}`.toLowerCase()
        return searchable.includes(normalizedQuery)
      })

      if (firstMatch) {
        setHighlightedSlashCommandId(firstMatch.id)
      }
      return
    }

    setIsSlashMenuOpen(false)
    setSlashQuery('')
  }

  useEffect(() => {
    if (!activePreviewFile) {
      setPreviewUrl(null)
      setTextPreview('')
      setTextPreviewLoading(false)
      return
    }

    const file = activePreviewFile.file

    if (isTextFile(file)) {
      setTextPreviewLoading(true)
      setTextPreview('')

      file
        .text()
        .then((content) => {
          setTextPreview(content)
        })
        .catch(() => {
          setTextPreview('Unable to preview this text file.')
        })
        .finally(() => {
          setTextPreviewLoading(false)
        })

      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [activePreviewFile])

  useEffect(() => {
    const handleDocumentKeydown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isTypingContext =
        activeElement instanceof HTMLElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable)

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        return
      }

      if (!isTypingContext && event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        inputRef.current?.focus()
        onPromptChange('/')
        setSlashQuery('')
        setIsSlashMenuOpen(true)
        setHighlightedSlashCommandId('summarize')
      }
    }

    window.addEventListener('keydown', handleDocumentKeydown)
    return () => {
      window.removeEventListener('keydown', handleDocumentKeydown)
    }
  }, [onPromptChange])

  useEffect(() => {
    if (!isToolsMenuOpen) {
      return
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (!toolsMenuRef.current) {
        return
      }

      const target = event.target
      if (target instanceof Node && !toolsMenuRef.current.contains(target)) {
        setIsToolsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [isToolsMenuOpen])

  useEffect(() => {
    if (!activePreviewFile) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePreviewFile(null)
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activePreviewFile])

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).map((file) => normalizeFileForUpload(file))
    if (files.length === 0) {
      return
    }

    setUploadedFiles((previousFiles) => {
      const nextFiles = files.map((file) => ({
        id: createFileId(),
        file,
      }))

      return [...previousFiles, ...nextFiles]
    })

    event.target.value = ''
  }

  function handleOpenFilePicker() {
    fileInputRef.current?.click()
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const clipboardItems = Array.from(event.clipboardData.items)
    const pastedImageFiles = clipboardItems
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)
      .map((file) => normalizeFileForUpload(file))

    if (pastedImageFiles.length === 0) {
      return
    }

    event.preventDefault()

    setUploadedFiles((previousFiles) => {
      const nextFiles = pastedImageFiles.map((file) => ({
        id: createFileId(),
        file,
      }))

      return [...previousFiles, ...nextFiles]
    })
  }

  function handleRemoveUploadedFile(fileId: string) {
    setUploadedFiles((previousFiles) => previousFiles.filter((item) => item.id !== fileId))

    if (activePreviewFile?.id === fileId) {
      setActivePreviewFile(null)
    }
  }

  function handleOpenPreview(file: UploadedFile) {
    setActivePreviewFile(file)
  }

  function handleClosePreview() {
    setActivePreviewFile(null)
  }

  function renderPreviewContent() {
    if (!activePreviewFile) {
      return null
    }

    const file = activePreviewFile.file
    const previewVisual = getUploadFileVisual(file)

    if (isImageFile(file) && previewUrl) {
      return (
        <img
          src={previewUrl}
          alt={file.name}
          className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
        />
      )
    }

    if (isPdfFile(file) && previewUrl) {
      return (
        <iframe
          title={file.name}
          src={previewUrl}
          className="h-[70vh] w-full rounded-xl border border-[#E5E5E5] bg-white shadow-sm dark:border-white/10 dark:bg-[#242424]"
        />
      )
    }

    if (isTextFile(file)) {
      if (textPreviewLoading) {
        return <div className="text-[14px] text-[#6B7280] dark:text-gray-400">Loading preview...</div>
      }

      return (
        <pre className="h-[70vh] w-full overflow-auto rounded-xl border border-[#E5E5E5] bg-white p-4 text-[13px] leading-relaxed text-gray-700 whitespace-pre-wrap shadow-sm dark:border-white/10 dark:bg-[#242424] dark:text-gray-200">
          {textPreview}
        </pre>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center gap-3 text-[#6B7280] dark:text-gray-400">
        <previewVisual.Icon className={`size-12 ${previewVisual.iconClassName}`} strokeWidth={1.5} aria-hidden />
        <p className="text-[14px]">Preview is not available for this file type.</p>
      </div>
    )
  }

  return (
    <>
      <div
        className={`mb-3 flex w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${shouldShowTemplates ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2 h-0 mb-0 overflow-hidden'} transition-all duration-200`}
      >
        {quickTemplates.map((template) => (
          <button
            key={template.renderKey ?? template.id}
            type="button"
            onClick={() => handleQuickTemplate(template)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3.5 py-1.5 text-[13px] font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#2f2f2f] dark:text-gray-300 dark:hover:bg-[#3a3a3a]"
          >
            <template.Icon className={`size-3.5 ${template.iconClassName}`} />
            {template.label}
          </button>
        ))}
      </div>

      <div
        className={`relative z-20 w-full max-w-3xl border border-[#E5E5E5] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#2f2f2f] dark:shadow-[0_2px_24px_rgba(0,0,0,0.35)] ${isBottomDocked ? 'rounded-t-[32px] rounded-b-none border-b-0 shadow-none' : 'rounded-[32px]'}`}
      >
        <div className="flex flex-col gap-3 px-3 pt-2 pb-8">
          <div
            className={`w-full gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${uploadedFiles.length === 0 ? 'hidden' : 'flex'}`}
          >
            {uploadedFiles.map((item) => (
              (() => {
                const visual = getUploadFileVisual(item.file)
                return (
              <div
                key={item.id}
                onClick={() => handleOpenPreview(item)}
                className="flex max-w-[200px] shrink-0 cursor-pointer items-center gap-2 rounded-[10px] border border-[#E5E5E5] bg-white px-3 py-2 text-[13px] text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#242424] dark:text-gray-200 dark:hover:bg-white/10"
              >
                <div className={`shrink-0 ${visual.iconClassName}`}>
                  <visual.Icon className="size-3.5" aria-hidden />
                </div>
                <span className="truncate font-medium">{item.file.name}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleRemoveUploadedFile(item.id)
                  }}
                  className="ml-auto shrink-0 text-gray-400 transition-colors hover:text-gray-800 dark:text-gray-500 dark:hover:text-gray-200"
                  aria-label={`Remove ${item.file.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
                )
              })()
            ))}
          </div>

          <div className="relative flex w-full items-center gap-2">
            <div
              className={`absolute bottom-full left-0 z-50 mb-3 w-[280px] overflow-hidden rounded-[16px] border border-[#E5E5E5] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all dark:border-white/10 dark:bg-[#2f2f2f] ${isSlashMenuOpen ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'}`}
            >
              <div className="flex items-center justify-between border-b border-[#E5E5E5] bg-gray-50 px-3 py-2.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase dark:border-white/10 dark:bg-[#1a1a1a] dark:text-gray-500">
                <span>Commands</span>
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  ↑↓ to navigate
                </span>
              </div>

              <div className="max-h-[220px] overflow-y-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filteredSlashCommands.length > 0 ? (
                  filteredSlashCommands.map((command) => {
                    const isHighlighted = highlightedSlashCommandId === command.id

                    return (
                      <button
                        key={command.id}
                        type="button"
                        onClick={() => selectSlashCommand(command)}
                        onMouseEnter={() => setHighlightedSlashCommandId(command.id)}
                        className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors ${isHighlighted ? 'bg-gray-100 dark:bg-[#3a3a3a]' : 'hover:bg-gray-100 dark:hover:bg-[#3a3a3a]'}`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5E5E5] ${command.iconSurfaceClassName} dark:border-white/10`}
                        >
                          <command.Icon className={`size-4 ${command.iconClassName}`} />
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{command.label}</span>
                          <span className="truncate text-[11px] text-gray-500 dark:text-gray-400">{command.description}</span>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="px-2.5 py-2 text-[12px] text-gray-500 dark:text-gray-400">No commands found.</div>
                )}
              </div>
            </div>

            {activeSlashCommand ? (
              <div className="flex shrink-0 items-center gap-1.5 rounded-[8px] border border-[#E5E5E5] bg-[#F3F4F6] px-2.5 py-1 text-[13px] font-bold text-gray-800 shadow-sm dark:border-white/10 dark:bg-[#3a3a3a] dark:text-gray-200">
                <activeSlashCommand.Icon className={`size-3.5 ${activeSlashCommand.iconClassName}`} />
                <span>{activeSlashCommand.label}</span>
                <button
                  type="button"
                  onClick={() => setActiveSlashCommandId(null)}
                  className="ml-0.5 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-100"
                  aria-label="Remove command"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}

            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={(event) => handlePromptChange(event.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={activeSlashCommand ? 'Add details for this command...' : 'Ask Leo a question...'}
              disabled={isLoading}
              className="w-full min-w-0 bg-transparent text-[16px] text-gray-800 placeholder:text-[#9CA3AF] outline-none dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2.5 pl-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
            <button
              type="button"
              onClick={handleOpenFilePicker}
              className="ghost-icon-btn flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E5E5] text-[#6B7280] transition-colors hover:text-gray-900 dark:border-white/10 dark:text-gray-300 dark:hover:text-gray-100"
              aria-label="Upload files"
            >
              <Plus className="size-4" />
            </button>

            <div ref={toolsMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsToolsMenuOpen((previous) => !previous)}
                className="flex h-8 items-center gap-1.5 rounded-md border border-[#E5E5E5] px-3 text-[13px] font-medium text-[#6B7280] transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
                aria-label="Tools"
                title="Tools"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                Tools
              </button>

              <div
                className={`absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-[20px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_4px_32px_rgba(0,0,0,0.06)] transition-all duration-200 dark:border-white/10 dark:bg-[#242424] dark:shadow-[0_6px_28px_rgba(0,0,0,0.45)] ${isToolsMenuOpen ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'}`}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onWebSearchChange(!webSearchActive)
                  }}
                  className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  <div className="lovechat-accent-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                    <Globe className="size-3.5" />
                  </div>
                  <span className="flex-1 text-left font-medium">Web Search</span>
                  <Check className={`lovechat-accent-text size-4 ${webSearchActive ? '' : 'hidden'}`} />
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onLearningModeChange(!learningModeActive)
                  }}
                  className="mt-0.5 flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/30">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#A855F7"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c3 3 9 3 12 0v-5" />
                    </svg>
                  </div>
                  <span className="flex-1 text-left font-medium">Learning Mode</span>
                  <Check className={`size-4 text-purple-500 ${learningModeActive ? '' : 'hidden'}`} />
                </button>

                {onCanvasModeChange ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCanvasModeChange(!isCanvasMode)
                      setIsToolsMenuOpen(false)
                    }}
                    className="mt-0.5 flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/10"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/10">
                      <Code2 className="size-3.5 text-gray-700 dark:text-gray-200" />
                    </div>
                    <span className="flex-1 text-left font-medium">Canvas</span>
                    <Check className={`size-4 text-gray-700 dark:text-gray-200 ${isCanvasMode ? '' : 'hidden'}`} />
                  </button>
                ) : null}
              </div>
            </div>

            {webSearchActive ? (
              <div className="lovechat-accent-chip flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px]">
                <Globe className="size-3.5 shrink-0" />
                <span className="font-medium whitespace-nowrap">Web Search</span>
                <button
                  type="button"
                  onClick={() => onWebSearchChange(false)}
                  className="lovechat-accent-chip-dismiss ml-0.5 flex shrink-0 items-center justify-center transition-colors"
                  aria-label="Disable web search"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}

            {learningModeActive ? (
              <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-[#E9D5FF] bg-[#FAF5FF] px-2.5 text-[13px] text-[#9333EA] dark:border-purple-800/50 dark:bg-purple-900/30 dark:text-purple-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <span className="font-medium whitespace-nowrap">Learning Mode</span>
                <button
                  type="button"
                  onClick={() => onLearningModeChange(false)}
                  className="ml-0.5 flex shrink-0 items-center justify-center text-[#C084FC] transition-colors hover:text-[#9333EA] dark:text-purple-500 dark:hover:text-purple-300"
                  aria-label="Disable learning mode"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}

            {isCanvasMode && onCanvasModeChange ? (
              <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-gray-200 bg-gray-50 px-2.5 text-[13px] text-gray-700 dark:border-white/15 dark:bg-white/5 dark:text-gray-200">
                <Code2 className="size-3.5 shrink-0" />
                <span className="font-medium whitespace-nowrap">Canvas</span>
                <button
                  type="button"
                  onClick={() => onCanvasModeChange(false)}
                  className="ml-0.5 flex shrink-0 items-center justify-center text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200"
                  aria-label="Disable canvas mode"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-4 pr-1">
            <ModelSelector selectedModel={selectedModel} onModelChange={onModelChange} />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading ? !isStopEnabled : isSubmitDisabled}
              aria-label={isLoading ? 'Stop response' : 'Send message'}
              title={isLoading ? 'Stop response' : 'Send message'}
              className="lovechat-accent-button flex h-8 w-8 items-center justify-center rounded-lg border border-transparent shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Square className="size-3.5 fill-current" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {activePreviewFile ? (
        <div
          role="presentation"
          onClick={handleClosePreview}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activePreviewFile.file.name}
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl dark:bg-[#2b2b2b]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E5E5] p-4 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                <div className="shrink-0 text-gray-500 dark:text-gray-400">
                  {(() => {
                    const visual = getUploadFileVisual(activePreviewFile.file)
                    return <visual.Icon className={`size-[18px] ${visual.iconClassName}`} aria-hidden />
                  })()}
                </div>
                <h3 className="truncate text-[15px] font-medium text-gray-800 dark:text-gray-100">{activePreviewFile.file.name}</h3>
              </div>

              <button
                type="button"
                onClick={handleClosePreview}
                className="ghost-icon-btn rounded-lg p-1.5 text-gray-400 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                aria-label="Close file preview"
              >
                <X className="size-[18px]" />
              </button>
            </div>

            <div className="flex min-h-[50vh] flex-1 items-center justify-center overflow-auto bg-[#F9FAFB] p-6 dark:bg-[#202020]">
              {renderPreviewContent()}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export { ChatInput }
