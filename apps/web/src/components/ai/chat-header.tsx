import { LogOut, Settings, UserRound } from 'lucide-react'
import ThemeToggle from '#/components/ThemeToggle'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '#/components/ui/menu'

type ChatHeaderProps = {
  avatarInitials: string
  onToggleSidebar: () => void
  onOpenProfile: () => void
  onOpenSettings: () => void
  onLogout: () => void
}

function ChatHeader({
  avatarInitials,
  onToggleSidebar,
  onOpenProfile,
  onOpenSettings,
  onLogout,
}: ChatHeaderProps) {
  return (
    <header className="absolute top-0 right-0 left-0 z-20 flex w-full items-center justify-between bg-white/80 p-4 backdrop-blur-sm md:bg-transparent">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none"
          aria-label="Toggle sidebar"
          title="Toggle Sidebar"
          onClick={onToggleSidebar}
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
        <span className="text-[20px] font-bold tracking-tight text-gray-900">LoveChat</span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <Menu>
          <MenuTrigger
            aria-label="Open profile menu"
            className="h-9 w-9 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#C7D2FE]"
          >
            <Avatar className="h-9 w-9 bg-gray-100 text-[13px] font-bold text-gray-800 transition-colors hover:bg-gray-200 dark:bg-[#333333] dark:text-gray-200 dark:hover:bg-[#444444]">
              <AvatarFallback>{avatarInitials}</AvatarFallback>
            </Avatar>
          </MenuTrigger>
          <MenuPopup
            align="end"
            sideOffset={8}
            className="w-48 overflow-hidden rounded-[16px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#242424] dark:shadow-[0_6px_28px_rgba(0,0,0,0.45)]"
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
              className="cursor-pointer gap-2.5 rounded-[10px] px-3 py-2 text-[14px] text-[#C53030] data-highlighted:bg-[#FEF2F2] data-highlighted:text-[#9B2C2C] dark:text-red-400 dark:data-highlighted:bg-red-500/15 dark:data-highlighted:text-red-300"
              variant="destructive"
              onClick={onLogout}
            >
              <LogOut className="size-4" />
              Log out
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
    </header>
  )
}

export { ChatHeader }
