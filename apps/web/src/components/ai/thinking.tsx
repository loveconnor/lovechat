import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '#/lib/utils'

const TIMER_CONFIG = {
  INTERVAL: 1000,
} as const

function useTimer() {
  const [timer, setTimer] = useState(0)

  useEffect(() => {
    const intervalRef = window.setInterval(() => {
      setTimer((prev) => prev + 1);
    }, TIMER_CONFIG.INTERVAL)

    return () => {
      window.clearInterval(intervalRef)
    }
  }, [])

  return timer
}

interface ThinkingHeaderProps {
  timer: number
  text: string
}

function ThinkingHeader({ timer, text }: ThinkingHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      <span className="relative inline-block text-sm text-gray-900">
        {text}
      </span>
      <span
        aria-label={`${timer} seconds elapsed`}
        className="text-muted-foreground text-sm"
      >
        {timer}s
      </span>
    </div>
  )
}

type AIThinkingVariant = 'thinking' | 'image-generating'

function ImageGeneratingCard() {
  return (
    <div className="lovechat-image-mesh-card relative isolate flex aspect-video w-full max-w-lg items-center justify-center overflow-hidden rounded-[20px] border border-[#E5E5E5]/50 bg-[#FAFAFA] shadow-sm dark:border-gray-700/50 dark:bg-[#121212]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="lovechat-mesh-blob lovechat-mesh-blob-a animate-blob absolute -left-[10%] -top-[20%] h-[70%] w-[70%] rounded-full blur-[60px]" />
        <div className="lovechat-mesh-blob lovechat-mesh-blob-b animate-blob animation-delay-2000 absolute -bottom-[20%] -right-[10%] h-[70%] w-[70%] rounded-full blur-[60px]" />
        <div className="lovechat-mesh-blob lovechat-mesh-blob-c animate-blob animation-delay-4000 absolute left-[20%] top-[20%] h-[60%] w-[60%] rounded-full blur-[60px]" />
      </div>
    </div>
  )
}

export default function AIThinking({
  className,
  text,
  variant = 'thinking',
}: {
  className?: string
  text?: string
  variant?: AIThinkingVariant
}) {
  const timer = useTimer()
  const resolvedText = useMemo(
    () => text?.trim() || 'LoveChat is thinking... ',
    [text],
  )

  const resolvedImageText = useMemo(
    () => text?.trim() || "I'm working on that for you right now...",
    [text],
  )

  if (variant === 'image-generating') {
    return (
      <div className={cn('flex max-w-3xl flex-col gap-3', className)} role="status" aria-live="polite">
        <p className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-200">{resolvedImageText}</p>
        <ImageGeneratingCard />
      </div>
    )
  }

  return (
    <div className={cn('flex max-w-xl flex-col gap-3', className)} role="status" aria-live="polite">
      <ThinkingHeader timer={timer} text={resolvedText} />
    </div>
  )
}
