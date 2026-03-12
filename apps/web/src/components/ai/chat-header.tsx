import ThemeToggle from '#/components/ThemeToggle'

function ChatHeader() {
  return (
    <header className="absolute top-0 right-0 left-0 z-20 flex w-full items-center justify-between bg-white/80 p-4 backdrop-blur-sm transition-colors duration-200 md:bg-transparent dark:bg-[#212121]/80 dark:md:bg-transparent">
      <div className="flex items-center gap-2 pl-2">
        <span className="text-[20px] font-bold tracking-tight text-gray-900 dark:text-gray-100">LoveChat</span>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  )
}

export { ChatHeader }
