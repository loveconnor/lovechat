import { Ellipsis, LogOut, Pencil, Plus, Search, Settings, Trash2, UserRound } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '#/components/ui/menu'

type ChatSidebarSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

type ChatSidebarProps = {
  isOpen: boolean
  isSessionsLoading: boolean
  groupedSessions: Record<string, ChatSidebarSession[]>
  activeSessionId: string | null
  avatarInitials: string
  profileName: string
  onToggleSidebar: () => void
  onOpenProfile: () => void
  onOpenSettings: () => void
  onLogout: () => void
  onCreateNewChat: () => Promise<void>
  onOpenSession: (sessionId: string) => Promise<void>
  onRenameSession: (sessionId: string, title: string) => Promise<void>
  onDeleteSessionIntent: (sessionId: string) => void
}

function ChatSidebar({
  isOpen,
  isSessionsLoading,
  groupedSessions,
  activeSessionId,
  avatarInitials,
  profileName,
  onToggleSidebar,
  onOpenProfile,
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

  return (
    <aside
      className={`group relative z-20 h-full shrink-0 overflow-hidden bg-[#F9FAFB] transition-[width,background-color] duration-300 dark:bg-[#212121] ${isOpen ? 'w-[260px]' : 'w-[68px] cursor-pointer'}`}
      onClick={(event) => {
        if (isOpen) {
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
        <div className={`flex h-14 shrink-0 items-center ${isOpen ? 'justify-between px-3' : 'justify-center px-0'}`}>
          {isOpen ? (
            <div className="flex h-8 w-8 items-center justify-center text-gray-800 dark:text-[#E5E7EB]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="group-hover/logo:hidden"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="hidden group-hover/logo:block"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}

          {isOpen ? (
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-1 px-3 pb-2">
          <button
            type="button"
            onClick={() => void onCreateNewChat()}
            className={`flex w-full items-center rounded-lg bg-transparent px-3 py-2.5 text-gray-700 transition-colors dark:text-gray-200 ${isOpen ? 'gap-3 justify-start hover:bg-gray-200 dark:hover:bg-[#3a3a3a]' : 'justify-center px-0 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <Plus className="size-[18px] shrink-0 text-inherit" />
            <span className={`text-[14px] font-medium whitespace-nowrap ${isOpen ? '' : 'hidden'}`}>New chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isOpen) {
                onToggleSidebar()
                return
              }

              setShowSearchInput((previous) => !previous)
            }}
            className={`flex w-full items-center rounded-lg bg-transparent px-3 py-2 text-gray-700 transition-colors dark:text-gray-200 ${isOpen ? 'gap-3 justify-start hover:bg-gray-200 dark:hover:bg-[#3a3a3a]' : 'justify-center px-0 hover:text-gray-900 dark:hover:text-white'}`}
          >
            <Search className="size-[18px] shrink-0 text-inherit" />
            <span className={`text-[14px] font-medium whitespace-nowrap ${isOpen ? '' : 'hidden'}`}>Search chats</span>
          </button>
        </div>

        {isOpen && showSearchInput ? (
          <div className="px-3 pb-2">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search chats..."
              className="w-full rounded-lg border border-[#E5E5E5] bg-white px-2.5 py-2 text-[13px] text-gray-800 outline-none placeholder:text-gray-400 focus:border-gray-300 dark:border-white/10 dark:bg-[#2f2f2f] dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
        ) : null}

        <div className={`flex-1 overflow-y-auto px-3 py-2 pb-6 ${isOpen ? '' : 'hidden'}`}>
          {isSessionsLoading ? (
            <p className="px-2 text-[13px] text-gray-500 dark:text-gray-400">Loading chats...</p>
          ) : filteredSessionCount === 0 ? (
            <p className="px-2 text-[13px] text-gray-500 dark:text-gray-400">No chats yet. Start one with New chat.</p>
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

                      return (
                        <li
                          key={session.id}
                          className={`group flex items-center rounded-lg transition-colors ${isActive ? 'bg-[#E5E7EB] dark:bg-[#3a3a3a]' : 'hover:bg-[#E5E7EB] dark:hover:bg-[#2f2f2f]'}`}
                        >
                          {editingSessionId === session.id ? (
                            <input
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
                              className="mx-1 my-1 w-[calc(100%-2.5rem)] flex-1 rounded-md border border-blue-400 bg-white px-2 py-1 text-[13px] text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-blue-400/50 dark:bg-[#242424] dark:text-gray-100 dark:focus:border-blue-300 dark:focus:ring-blue-300/60"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => void onOpenSession(session.id)}
                              className="flex-1 truncate px-2 py-2 text-left text-[13px] text-gray-700 dark:text-gray-200"
                            >
                              {session.title}
                            </button>
                          )}

                          <Menu>
                            <MenuTrigger
                              aria-label="Chat options"
                              className="ghost-icon-btn mr-1 rounded p-1 text-gray-500 opacity-0 transition-all hover:text-gray-800 group-hover:opacity-100 focus-visible:opacity-100 dark:text-gray-400 dark:hover:text-gray-100"
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
              className={`flex w-full items-center rounded-lg bg-transparent py-2 transition-colors focus:outline-none data-[popup-open]:bg-transparent ${isOpen ? 'gap-2.5 justify-start px-2 hover:bg-gray-200 dark:hover:bg-[#3a3a3a]' : 'ghost-icon-btn justify-center px-0 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[12px] font-bold text-gray-800 dark:bg-[#333333] dark:text-gray-200">
                {avatarInitials}
              </div>
              <span className={`truncate text-[14px] font-medium text-gray-900 dark:text-gray-100 ${isOpen ? '' : 'hidden'}`}>
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
                onClick={onOpenProfile}
              >
                <UserRound className="size-4" />
                Profile
              </MenuItem>
              <MenuItem
                className="cursor-pointer gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-gray-700 data-highlighted:bg-gray-50 data-highlighted:text-gray-700 dark:text-gray-200 dark:data-highlighted:bg-white/10 dark:data-highlighted:text-gray-100"
                onClick={onOpenSettings}
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
