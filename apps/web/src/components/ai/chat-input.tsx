import { Check, ChevronDown, FileText, Globe, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/menu'

type ChatInputProps = {
  prompt: string
  onPromptChange: (value: string) => void
  onSubmit: (files: File[]) => void
  isLoading?: boolean
  selectedModel: string
  modelOptions: string[]
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

function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf'
}

function isTextFile(file: File) {
  return file.type.startsWith('text/')
}

function ModelLogo({ isActive }: { isActive: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 640 640"
      fill="currentColor"
      className={isActive ? 'text-black dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}
      aria-hidden="true"
    >
      <path d="M260.4 249.8L260.4 201.2C260.4 197.1 261.9 194 265.5 192L363.3 135.7C376.6 128 392.5 124.4 408.9 124.4C470.3 124.4 509.3 172 509.3 222.7C509.3 226.3 509.3 230.4 508.8 234.5L407.3 175.1C401.2 171.5 395 171.5 388.9 175.1L260.4 249.8zM488.7 439.2L488.7 323C488.7 315.8 485.6 310.7 479.5 307.1L351 232.4L393 208.3C396.6 206.3 399.7 206.3 403.2 208.3L501 264.7C529.2 281.1 548.1 315.9 548.1 349.7C548.1 388.6 525.1 424.5 488.7 439.3L488.7 439.3zM230.2 336.8L188.2 312.2C184.6 310.2 183.1 307.1 183.1 303L183.1 190.4C183.1 135.6 225.1 94.1 281.9 94.1C303.4 94.1 323.4 101.3 340.3 114.1L239.4 172.5C233.3 176.1 230.2 181.2 230.2 188.4L230.2 336.9L230.2 336.9zM320.6 389L260.4 355.2L260.4 283.5L320.6 249.7L380.8 283.5L380.8 355.2L320.6 389zM359.3 544.7C337.8 544.7 317.8 537.5 300.9 524.7L401.8 466.3C407.9 462.7 411 457.6 411 450.4L411 301.9L453.5 326.5C457.1 328.5 458.6 331.6 458.6 335.7L458.6 448.3C458.6 503.1 416.1 544.6 359.3 544.6L359.3 544.6zM237.8 430.5L140.1 374.2C111.9 357.8 93 323 93 289.2C93 249.8 116.6 214.4 152.9 199.6L152.9 316.3C152.9 323.5 156 328.6 162.1 332.2L290.1 406.4L248.1 430.5C244.5 432.5 241.4 432.5 237.9 430.5zM232.2 514.5C174.3 514.5 131.8 471 131.8 417.2C131.8 413.1 132.3 409 132.8 404.9L233.7 463.3C239.8 466.9 246 466.9 252.1 463.3L380.6 389.1L380.6 437.7C380.6 441.8 379.1 444.9 375.5 446.9L277.7 503.2C264.4 510.9 248.5 514.5 232.1 514.5L232.1 514.5zM359.2 575.4C421.2 575.4 472.9 531.4 484.6 473C541.9 458.1 578.8 404.4 578.8 349.6C578.8 313.8 563.4 278.9 535.8 253.9C538.4 243.1 539.9 232.4 539.9 221.6C539.9 148.4 480.5 93.6 411.9 93.6C398.1 93.6 384.8 95.6 371.5 100.3C348.5 77.8 316.7 63.4 281.9 63.4C219.9 63.4 168.2 107.4 156.5 165.8C99.2 180.6 62.3 234.4 62.3 289.2C62.3 325 77.7 359.9 105.3 384.9C102.7 395.7 101.2 406.4 101.2 417.2C101.2 490.4 160.6 545.2 229.2 545.2C243 545.2 256.3 543.2 269.6 538.5C292.6 561 324.4 575.4 359.2 575.4z" />
    </svg>
  )
}

function ChatInput({
  prompt,
  onPromptChange,
  onSubmit,
  isLoading = false,
  selectedModel,
  modelOptions,
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
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false)
  const toolsMenuRef = useRef<HTMLDivElement | null>(null)
  const isSubmitDisabled = isLoading || prompt.trim().length === 0

  function handleSubmit() {
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
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setUploadedFiles((previousFiles) => {
      const nextFiles = files.map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
      }))

      return [...previousFiles, ...nextFiles]
    })

    event.target.value = ''
  }

  function handleOpenFilePicker() {
    fileInputRef.current?.click()
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
        <FileText className="size-12" strokeWidth={1.5} aria-hidden="true" />
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
              <div
                key={item.id}
                onClick={() => handleOpenPreview(item)}
                className="flex max-w-[200px] shrink-0 cursor-pointer items-center gap-2 rounded-[10px] border border-[#E5E5E5] bg-white px-3 py-2 text-[13px] text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#242424] dark:text-gray-200 dark:hover:bg-white/10"
              >
                <div className="shrink-0 text-gray-500 dark:text-gray-400">
                  <FileText className="size-3.5" aria-hidden="true" />
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
            ))}
          </div>

          <input
            type="text"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={handleKeyDown}
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
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E5E5] text-[#6B7280] transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
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
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/15">
                    <Globe className="size-3.5 text-blue-500 dark:text-blue-300" />
                  </div>
                  <span className="flex-1 text-left font-medium">Web Search</span>
                  <Check className={`size-4 text-blue-500 dark:text-blue-300 ${webSearchActive ? '' : 'hidden'}`} />
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
              <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-[13px] text-[#2563EB] dark:border-blue-400/30 dark:bg-blue-500/12 dark:text-blue-300">
                <Globe className="size-3.5 shrink-0" />
                <span className="font-medium whitespace-nowrap">Web Search</span>
                <button
                  type="button"
                  onClick={() => onWebSearchChange(false)}
                  className="ml-0.5 flex shrink-0 items-center justify-center text-[#93C5FD] transition-colors hover:text-[#2563EB] dark:text-blue-300/70 dark:hover:text-blue-200"
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
            <DropdownMenu open={isModelMenuOpen} onOpenChange={setIsModelMenuOpen}>
              <DropdownMenuTrigger
                aria-label="Model selector"
                className="flex items-center gap-1.5 rounded-md bg-transparent py-1 text-[13px] text-[#6B7280] transition-colors hover:text-gray-900 focus-visible:outline-none dark:text-gray-300 dark:hover:text-gray-100"
              >
                <span>{selectedModel}</span>
                <ChevronDown className={`mt-[1px] size-3 transition-transform duration-200 ${isModelMenuOpen ? 'rotate-180' : ''}`} />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-56 rounded-[20px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_4px_32px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#242424] dark:shadow-[0_6px_28px_rgba(0,0,0,0.45)]"
              >
                {modelOptions.map((model) => (
                  (() => {
                    const isSelected = model === selectedModel

                    return (
                  <DropdownMenuItem
                    key={model}
                    onClick={() => onModelChange(model)}
                    className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-[14px] transition-colors ${isSelected ? 'bg-gray-100 font-medium text-gray-900 dark:bg-white/12 dark:text-gray-100' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/10'}`}
                  >
                    <ModelLogo isActive={isSelected} />
                    <span className="flex-1 text-left">{model}</span>
                    <Check className={`size-3.5 text-black dark:text-gray-100 ${isSelected ? '' : 'invisible'}`} />
                  </DropdownMenuItem>
                    )
                  })()
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E5E5] text-[#6B7280] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
            >
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
                  <FileText className="size-[18px]" aria-hidden="true" />
                </div>
                <h3 className="truncate text-[15px] font-medium text-gray-800 dark:text-gray-100">{activePreviewFile.file.name}</h3>
              </div>

              <button
                type="button"
                onClick={handleClosePreview}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
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