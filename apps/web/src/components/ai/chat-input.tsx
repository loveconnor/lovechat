import {
  Check,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Globe,
  Plus,
  Square,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ModelSelector } from '#/components/ai/model-selector'

type ChatInputProps = {
  prompt: string
  onPromptChange: (value: string) => void
  onSubmit: (files: File[]) => void
  onStop?: () => void
  isLoading?: boolean
  selectedModel: string
  onModelChange: (model: string) => void
  webSearchActive: boolean
  onWebSearchChange: (active: boolean) => void
  learningModeActive: boolean
  onLearningModeChange: (active: boolean) => void
}

type UploadedFile = {
  id: string
  file: File
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
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [activePreviewFile, setActivePreviewFile] = useState<UploadedFile | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [textPreview, setTextPreview] = useState<string>('')
  const [textPreviewLoading, setTextPreviewLoading] = useState(false)
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)
  const toolsMenuRef = useRef<HTMLDivElement | null>(null)
  const isSubmitDisabled = !isLoading && prompt.trim().length === 0
  const isStopEnabled = isLoading && typeof onStop === 'function'

  function handleSubmit() {
    if (isLoading) {
      onStop?.()
      return
    }

    if (isSubmitDisabled) {
      return
    }

    const selectedFiles = uploadedFiles.map((item) => item.file)
    onSubmit(selectedFiles)
    setUploadedFiles([])
    setActivePreviewFile(null)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    handleSubmit()
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
      <div className="relative z-20 w-full max-w-3xl rounded-[32px] border border-[#E5E5E5] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#2f2f2f] dark:shadow-[0_2px_24px_rgba(0,0,0,0.35)]">
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

          <input
            type="text"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask Leo a question..."
            disabled={isLoading}
            className="w-full bg-transparent text-[16px] text-gray-800 placeholder:text-[#9CA3AF] outline-none dark:text-gray-100 dark:placeholder:text-gray-500"
          />
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