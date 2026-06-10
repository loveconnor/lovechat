import { Ellipsis, GitBranch, LoaderCircle as Loader2, LogOut, MessageCircle, Package, PanelLeft, Pencil, Plus, Search, Settings, Trash2 } from 'love-ui/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '#/components/ui/empty'
import { Input } from '#/components/ui/input'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '#/components/ui/menu'

type ChatSidebarSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  branchDepth?: number
  generationStatus?: 'queued' | 'in_progress' | null
}

type ChatSidebarProps = {
  isOpen: boolean
  isMobile?: boolean
  isSessionsLoading: boolean
  groupedSessions: Record<string, ChatSidebarSession[]>
  activeSessionId: string | null
  avatarInitials: string
  avatarImageSrc: string | null
  profileName: string
  onToggleSidebar: () => void
  onOpenProfile: () => void
  onOpenSettings?: () => void
  onLogout: () => void
  onCreateNewChat: () => Promise<void>
  onOpenSession: (sessionId: string) => Promise<void>
  onRenameSession: (sessionId: string, title: string) => Promise<boolean>
  onDeleteSessionIntent: (sessionId: string) => void
}

function ChatSidebar({
  isOpen,
  isMobile = false,
  isSessionsLoading,
  groupedSessions,
  activeSessionId,
  avatarInitials,
  avatarImageSrc,
  profileName,
  onToggleSidebar,
  onOpenSettings,
  onLogout,
  onCreateNewChat,
  onOpenSession,
  onRenameSession,
  onDeleteSessionIntent,
}: ChatSidebarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchInput, setShowSearchInput] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const filteredGroupedSessions = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase()
    if (!trimmedQuery) {
      return groupedSessions
    }

    return Object.fromEntries(
      Object.entries(groupedSessions).map(([bucket, sessions]) => {
        const filtered = sessions.filter((session) => session.title.toLowerCase().includes(trimmedQuery))
        return [bucket, filtered]
      }),
    )
  }, [groupedSessions, searchQuery])

  const filteredSessionCount = useMemo(() => {
    return Object.values(filteredGroupedSessions).reduce((total, sessions) => total + sessions.length, 0)
  }, [filteredGroupedSessions])

  useEffect(() => {
    if (!editingSessionId || !inputRef.current) {
      return
    }

    inputRef.current.focus()
    inputRef.current.select()
  }, [editingSessionId])

  useEffect(() => {
    if (isOpen && showSearchInput && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, showSearchInput])

  useEffect(() => {
    if (!isOpen) {
      setShowSearchInput(false)
      setSearchQuery('')
    }
  }, [isOpen])

  async function commitRename(session: ChatSidebarSession) {
    const nextTitle = editingDraft.trim()

    setEditingSessionId(null)
    setEditingDraft('')

    if (!nextTitle || nextTitle === session.title) {
      return
    }

    await onRenameSession(session.id, nextTitle)
  }

  function startRename(session: ChatSidebarSession) {
    setEditingSessionId(session.id)
    setEditingDraft(session.title)
  }

  function cancelRename() {
    setEditingSessionId(null)
    setEditingDraft('')
  }

  const isExpanded = isMobile ? true : isOpen

  return (
    <aside
      className={isMobile
        ? 'group relative z-20 h-full w-[min(82vw,300px)] max-w-[300px] shrink-0 overflow-hidden border-r border-[#E5E5E5] bg-[#F9FAFB] dark:border-white/10 dark:bg-[#212121]'
        : `group relative z-20 h-full shrink-0 overflow-hidden bg-[#F9FAFB] transition-[width,background-color] duration-300 dark:bg-[#212121] ${isOpen ? 'w-[260px]' : 'w-[68px] cursor-pointer'}`}
      onClick={(event) => {
        if (isMobile || isOpen) {
          return
        }

        const target = event.target
        if (!(target instanceof Element)) {
          return
        }

        if (!target.closest('button')) {
          onToggleSidebar()
        }
      }}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className={`flex h-14 shrink-0 items-center ${isExpanded ? 'justify-between px-3' : 'justify-center px-0'}`}>
          {isExpanded ? (
            <div className="flex h-8 w-8 items-center justify-center text-gray-800 dark:text-[#E5E7EB]">
              <Package className="size-[22px]" />
            </div>
          ) : (
            <button
              type="button"
              className="ghost-icon-btn group/logo flex h-8 w-8 items-center justify-center rounded-lg !bg-transparent p-0 text-gray-800 transition-colors hover:text-gray-900 focus:outline-none dark:text-[#E5E7EB] dark:hover:text-white"
              aria-label="Expand sidebar"
              title="Expand sidebar"
              onClick={(event) => {
                event.stopPropagation()
                onToggleSidebar()
              }}
            >
              <Package className="size-[22px] group-hover/logo:hidden" />
              <PanelLeft className="hidden size-5 group-hover/logo:block" />
            </button>
          )}

          {isExpanded ? (
            <button
              type="button"
              className="ghost-icon-btn shrink-0 rounded-lg !bg-transparent p-1.5 text-gray-500 transition-colors hover:text-gray-900 focus:outline-none dark:text-gray-300 dark:hover:text-white"
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
              onClick={(event) => {
                event.stopPropagation()
                onToggleSidebar()
              }}
            >
              <PanelLeft className="size-5" />
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-1 px-3 pb-2">
          <button
            type="button"
            onClick={() => void onCreateNewChat()}
            className={`flex w-full items-center rounded-lg bg-transparent px-3 py-2.5 text-gray-700 transition-colors dark:text-gray-200 ${isExpanded ? 'gap-3 justify-start hover:bg-gray-200 dark:hover:bg-[#3a3a3a]' : 'justify-center px-0 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <Plus className="size-[18px] shrink-0 text-inherit" />
            <span className={`text-[14px] font-medium whitespace-nowrap ${isExpanded ? '' : 'hidden'}`}>New chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isExpanded) {
                onToggleSidebar()
                return
              }

              setShowSearchInput((previous) => !previous)
            }}
            className={`flex w-full items-center rounded-lg bg-transparent px-3 py-2 text-gray-700 transition-colors dark:text-gray-200 ${isExpanded ? 'gap-3 justify-start hover:bg-gray-200 dark:hover:bg-[#3a3a3a]' : 'justify-center px-0 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <Search className="size-[18px] shrink-0 text-inherit" />
            <span className={`text-[14px] font-medium whitespace-nowrap ${isExpanded ? '' : 'hidden'}`}>Search chats</span>
          </button>
        </div>

        {isExpanded && showSearchInput ? (
          <div className="px-3 pb-2">
            <Input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search chats..."
              size="sm"
              className="bg-white text-[13px] text-gray-800 dark:bg-[#2f2f2f] dark:text-gray-100 [&_[data-slot=input]]:px-2.5 [&_[data-slot=input]]:py-2"
            />
          </div>
        ) : null}

        <div className={`flex-1 overflow-y-auto px-3 py-2 pb-6 ${isExpanded ? '' : 'hidden'}`}>
          {isSessionsLoading ? (
            <p className="px-2 text-[13px] text-gray-500 dark:text-gray-400">Loading chats...</p>
          ) : filteredSessionCount === 0 ? (
            <Empty className="min-h-[220px] justify-center gap-4 rounded-xl border-none p-4 md:p-6">
              <EmptyHeader className="max-w-[220px]">
                <EmptyMedia variant="icon" className="mb-4">
                  {searchQuery.trim() ? <Search className="size-4" /> : <MessageCircle className="size-4" />}
                </EmptyMedia>
                <EmptyTitle className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                  {searchQuery.trim() ? 'No matching chats' : 'No chats yet'}
                </EmptyTitle>
                <EmptyDescription className="text-[13px] text-gray-500 dark:text-gray-400">
                  {searchQuery.trim() ? 'Try another search term.' : 'Create a new chat to get started.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            ['Today', 'Previous 7 Days', 'Older'].map((bucket) => {
              const bucketSessions = filteredGroupedSessions[bucket] ?? []
              if (bucketSessions.length === 0) {
                return null
              }

              return (
                <div key={bucket} className="mb-6">
                  <h4 className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                    {bucket}
                  </h4>
                  <ul className="space-y-0.5">
                    {bucketSessions.map((session) => {
                      const isActive = session.id === activeSessionId
                      const isGenerating =
                        session.generationStatus === 'queued' || session.generationStatus === 'in_progress'
                      const branchDepth = Math.max(0, Math.min(session.branchDepth ?? 0, 8))

                      return (
                        <li
                          key={session.id}
                          className={`group/session flex items-center rounded-lg transition-colors ${isActive ? 'lovechat-accent-session-active' : 'lovechat-accent-session-hover'}`}
                        >
                          {editingSessionId === session.id ? (
                            <Input
                              ref={inputRef}
                              type="text"
                              value={editingDraft}
                              onChange={(event) => setEditingDraft(event.target.value)}
                              onBlur={() => void commitRename(session)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  event.currentTarget.blur()
                                }

                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  cancelRename()
                                }
                              }}
                              size="sm"
                              className="mx-1 my-1 w-[calc(100%-2.5rem)] flex-1 bg-white text-[13px] text-gray-900 dark:bg-[#242424] dark:text-gray-100 [&_[data-slot=input]]:px-2 [&_[data-slot=input]]:py-1"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => void onOpenSession(session.id)}
                              className="flex-1 truncate px-2 py-2 text-left text-[13px] text-gray-700 dark:text-gray-200"
                            >
                              <span
                                className="flex items-center gap-1.5"
                                style={{ paddingLeft: `${branchDepth * 12}px` }}
                              >
                                {branchDepth > 0 ? <GitBranch className="size-3.5 shrink-0 text-gray-400" /> : null}
                                <span className="truncate">{session.title}</span>
                              </span>
                            </button>
                          )}

                          {isGenerating ? (
                            <span className="mr-1 inline-flex items-center text-gray-500 dark:text-gray-300" aria-label="Generating response">
                              <Loader2 className="size-3.5 animate-spin" />
                            </span>
                          ) : null}

                          <Menu>
                            <MenuTrigger
                              aria-label="Chat options"
                              className="ghost-icon-btn mr-1 rounded p-1 text-gray-500 opacity-0 transition-all hover:text-gray-800 group-hover/session:opacity-100 focus-visible:opacity-100 dark:text-gray-400 dark:hover:text-gray-100"
                            >
                              <Ellipsis className="size-3.5" />
                            </MenuTrigger>
                            <MenuPopup align="end" sideOffset={6} className="min-w-32">
                              <MenuItem
                                className="cursor-pointer text-[13px]"
                                onClick={() => startRename(session)}
                              >
                                <Pencil className="size-3.5" />
                                Rename
                              </MenuItem>
                              <MenuItem
                                className="cursor-pointer text-[13px] text-[#C53030] data-highlighted:bg-[#FEF2F2] data-highlighted:text-[#9B2C2C] dark:text-[#FC8181] dark:data-highlighted:bg-red-500/10 dark:data-highlighted:text-[#FEB2B2]"
                                variant="destructive"
                                onClick={() => onDeleteSessionIntent(session.id)}
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </MenuItem>
                            </MenuPopup>
                          </Menu>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </div>

        <div className="relative mt-auto shrink-0 p-3">
          <Menu>
            <MenuTrigger
              aria-label="Open profile menu"
              className={`flex w-full items-center rounded-lg bg-transparent py-2 transition-colors focus:outline-none data-[popup-open]:bg-transparent ${isExpanded ? 'gap-2.5 justify-start px-2 hover:bg-gray-200 dark:hover:bg-[#3a3a3a]' : 'ghost-icon-btn justify-center px-0 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-[12px] font-bold text-gray-800 dark:bg-[#333333] dark:text-gray-200">
                {avatarImageSrc ? (
                  <img src={avatarImageSrc} alt="Profile avatar" className="h-full w-full object-cover" />
                ) : (
                  avatarInitials
                )}
              </div>
              <span className={`truncate text-[14px] font-medium text-gray-900 dark:text-gray-100 ${isExpanded ? '' : 'hidden'}`}>
                {profileName}
              </span>
            </MenuTrigger>
            <MenuPopup
              align="start"
              sideOffset={8}
              className="w-56 overflow-hidden rounded-[16px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#2f2f2f]"
            >
              <MenuItem
                className="cursor-pointer gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-gray-700 data-highlighted:bg-gray-50 data-highlighted:text-gray-700 dark:text-gray-200 dark:data-highlighted:bg-white/10 dark:data-highlighted:text-gray-100"
                onClick={() => {
                  onOpenSettings?.()
                }}
              >
                <Settings className="size-4" />
                Settings
              </MenuItem>
              <MenuSeparator className="mx-2 my-1 h-px bg-[#E5E5E5] dark:bg-white/10" />
              <MenuItem
                className="cursor-pointer gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-[#C53030] data-highlighted:bg-[#FEF2F2] data-highlighted:text-[#9B2C2C] dark:text-[#FC8181] dark:data-highlighted:bg-red-500/10 dark:data-highlighted:text-[#FEB2B2]"
                variant="destructive"
                onClick={onLogout}
              >
                <LogOut className="size-4" />
                Log out
              </MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </div>
    </aside>
  )
}

export { ChatSidebar }
export type { ChatSidebarSession }
