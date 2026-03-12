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

export default function AIThinking({ className, text }: { className?: string; text?: string }) {
  const timer = useTimer()
  const resolvedText = useMemo(
    () => text?.trim() || 'LoveChat is thinking... ',
    [text],
  )

  return (
    <div className={cn('flex max-w-xl flex-col gap-3', className)} role="status" aria-live="polite">
      <ThinkingHeader timer={timer} text={resolvedText} />
    </div>
  )
}
