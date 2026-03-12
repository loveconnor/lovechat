import { createFileRoute } from '@tanstack/react-router'
import { ChatLanding } from '#/components/ai/chat-landing'

export const Route = createFileRoute('/chat')({
  component: ChatLanding,
})
