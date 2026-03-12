import { Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '#/components/ui/menu'

type ChatSidebarSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

type ChatSidebarProps = {
  isOpen: boolean
  isSessionsLoading: boolean
  chatSessions: ChatSidebarSession[]
  groupedSessions: Record<string, ChatSidebarSession[]>
  activeSessionId: string | null
  onCreateNewChat: () => Promise<void>
  onOpenSession: (sessionId: string) => Promise<void>
  onRenameSession: (sessionId: string, title: string) => Promise<void>
  onDeleteSessionIntent: (sessionId: string) => void
}

function ChatSidebar({
  isOpen,
  isSessionsLoading,
  chatSessions,
  groupedSessions,
  activeSessionId,
  onCreateNewChat,
  onOpenSession,
  onRenameSession,
  onDeleteSessionIntent,
}: ChatSidebarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!editingSessionId || !inputRef.current) {
      return
    }

    inputRef.current.focus()
    inputRef.current.select()
  }, [editingSessionId])

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
      className={`relative shrink-0 bg-[#F9FAFB] transition-all duration-300 dark:bg-[#171717] ${isOpen ? 'w-[260px] border-r border-[#E5E5E5] dark:border-white/10' : 'w-0 border-r border-transparent'}`}
    >
      <div
        className={`flex h-full flex-col overflow-hidden transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <div className="p-3">
          <button
            type="button"
            onClick={() => void onCreateNewChat()}
            className="flex w-full items-center justify-between rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-[14px] text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-[#2f2f2f] dark:text-gray-100 dark:hover:bg-white/10"
          >
            <span className="font-medium">New chat</span>
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
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 pb-6">
          {isSessionsLoading ? (
            <p className="px-2 text-[13px] text-gray-500 dark:text-gray-400">Loading chats...</p>
          ) : chatSessions.length === 0 ? (
            <p className="px-2 text-[13px] text-gray-500 dark:text-gray-400">No chats yet. Start one with New chat.</p>
          ) : (
            ['Today', 'Previous 7 Days', 'Older'].map((bucket) => {
              const bucketSessions = groupedSessions[bucket] ?? []
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
                              className="mr-1 rounded p-1 text-gray-500 opacity-0 transition-all hover:bg-gray-300 hover:text-gray-800 group-hover:opacity-100 focus-visible:opacity-100 dark:text-gray-400 dark:hover:bg-[#3a3a3a] dark:hover:text-gray-100"
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
                                className="cursor-pointer text-[13px]"
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
      </div>
    </aside>
  )
}

export { ChatSidebar }
export type { ChatSidebarSession }
