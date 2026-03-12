import { useEffect, useRef, useState } from 'react'
import { CodeXml, FileText, Link2, Pencil, SquareX, Trash2 } from 'lucide-react'
import ThemeToggle from '#/components/ThemeToggle'

type ChatHeaderProps = {
  chatTitle?: string
  onCopyLink: () => void | Promise<void>
  onExportPdf: () => void
  onExportMarkdown: () => void
  onRenameChat: () => void | Promise<void>
  onClearChat: () => void
  onDeleteChat: () => void
}

function ChatHeader({
  chatTitle,
  onCopyLink,
  onExportPdf,
  onExportMarkdown,
  onRenameChat,
  onClearChat,
  onDeleteChat,
}: ChatHeaderProps) {
  const [openDropdown, setOpenDropdown] = useState<'share' | 'more' | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!headerRef.current) {
        return
      }

      if (!headerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function toggleDropdown(target: 'share' | 'more') {
    setOpenDropdown((current) => (current === target ? null : target))
  }

  const isShareOpen = openDropdown === 'share'
  const isMoreOpen = openDropdown === 'more'

  return (
    <header
      ref={headerRef}
      className="absolute top-0 right-0 left-0 z-20 flex w-full items-center justify-between bg-white/80 p-4 backdrop-blur-sm transition-colors duration-200 md:bg-transparent dark:bg-[#212121]/80 dark:md:bg-transparent"
    >
      <div className="flex items-center gap-2 pl-2">
        <span className="text-[20px] font-bold tracking-tight text-gray-900 dark:text-gray-100">LoveChat</span>
      </div>

      <div className="pointer-events-none absolute left-1/2 max-w-[min(52vw,36rem)] -translate-x-1/2 px-3 text-center">
        <p className="truncate text-[15px] font-semibold tracking-tight text-gray-800 dark:text-gray-100">{chatTitle ?? 'New chat'}</p>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleDropdown('share')}
            className="flex h-9 items-center gap-2 rounded-lg px-3 text-[14px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100"
            aria-haspopup="menu"
            aria-expanded={isShareOpen}
            aria-label="Share"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
            <span className="hidden sm:inline">Share</span>
          </button>

          <div
            className={`absolute top-full right-0 z-[100] mt-2 w-48 overflow-hidden rounded-[16px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-all duration-200 dark:border-gray-700 dark:bg-[#2f2f2f] ${
              isShareOpen
                ? 'visible translate-y-0 opacity-100'
                : 'invisible translate-y-1 opacity-0'
            }`}
            role="menu"
            aria-label="Share options"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/10"
              onClick={() => {
                setOpenDropdown(null)
                void onCopyLink()
              }}
            >
              <Link2 size={16} strokeWidth={2} />
              Copy Link
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/10"
              onClick={() => {
                setOpenDropdown(null)
                onExportPdf()
              }}
            >
              <FileText size={16} strokeWidth={2} />
              Export to PDF
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/10"
              onClick={() => {
                setOpenDropdown(null)
                onExportMarkdown()
              }}
            >
              <CodeXml size={16} strokeWidth={2} />
              <span className="whitespace-nowrap">Export to Markdown</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => toggleDropdown('more')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100"
            title="More Options"
            aria-haspopup="menu"
            aria-expanded={isMoreOpen}
            aria-label="More options"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.5"></circle>
              <circle cx="12" cy="12" r="1.5"></circle>
              <circle cx="19" cy="12" r="1.5"></circle>
            </svg>
          </button>

          <div
            className={`absolute top-full right-0 z-[100] mt-2 w-48 overflow-hidden rounded-[16px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-all duration-200 dark:border-gray-700 dark:bg-[#2f2f2f] ${
              isMoreOpen
                ? 'visible translate-y-0 opacity-100'
                : 'invisible translate-y-1 opacity-0'
            }`}
            role="menu"
            aria-label="Chat options"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/10"
              onClick={() => {
                setOpenDropdown(null)
                void onRenameChat()
              }}
            >
              <Pencil size={16} strokeWidth={2} />
              Rename Chat
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/10"
              onClick={() => {
                setOpenDropdown(null)
                onClearChat()
              }}
            >
              <SquareX size={16} strokeWidth={2} />
              Clear Chat
            </button>
            <div className="mx-auto my-1 h-px w-full max-w-[calc(100%-16px)] bg-[#E5E5E5] dark:bg-white/10"></div>
            <button
              type="button"
              className="chat-delete-item flex w-full items-center gap-2.5 rounded-[10px] bg-transparent px-3 py-2 text-[14px] text-[#C53030] transition-colors hover:bg-[#FEF2F2] hover:text-[#9B2C2C] dark:bg-transparent dark:text-[#FC8181] dark:hover:bg-red-500/10 dark:hover:text-[#FEB2B2]"
              onClick={() => {
                setOpenDropdown(null)
                onDeleteChat()
              }}
            >
              <Trash2 size={16} strokeWidth={2} />
              Delete Chat
            </button>
          </div>
        </div>

        <div className="ml-1 sm:ml-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export { ChatHeader }
