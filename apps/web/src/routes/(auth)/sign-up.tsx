import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ArrowUp } from 'love-ui/icons'
import { Github, GoogleIcon } from 'love-ui/logos'

export const Route = createFileRoute('/(auth)/sign-up')({
  component: SignUpPage,
})

type SignUpResponse = {
  user: {
    id: number
    email: string
  }
  token: string
}

function SignUpPage() {
  const navigate = useNavigate()
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL ?? 'http://localhost:4000', [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`${apiBaseUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const payload = (await response.json()) as Partial<SignUpResponse> & {
        message?: string
      }

      if (!response.ok) {
        setError(payload.message ?? 'Unable to create account')
        return
      }

      if (payload.token) {
        window.localStorage.setItem('lovechat_session_token', payload.token)
      }

      setSuccess('Account created. Starting onboarding...')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      await sleep(350)
      await navigate({ to: '/onboarding' })
    } catch {
      setError('Unable to reach the backend. Check that the API is running.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main
      className="flex h-screen w-full overflow-hidden bg-white text-black dark:bg-[#181818] dark:text-gray-100"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center overflow-y-auto px-6 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-[340px]">
          <h1 className="mb-8 text-[28px] font-bold tracking-tight text-black dark:text-gray-100">Sign Up</h1>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mb-3 w-full gap-3 text-[14px] font-medium text-black dark:text-gray-100"
          >
            <Github size={18} />
            <span>Continue with Github</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mb-6 w-full gap-3 text-[14px] font-medium text-black dark:text-gray-100"
          >
            <GoogleIcon size={18} />
            <span>Continue with Google</span>
          </Button>

          <div className="mb-6 flex w-full items-center">
            <div className="flex-1 border-t border-gray-100 dark:border-white/10" />
            <span className="px-3 text-[11px] font-medium text-gray-400 lowercase dark:text-gray-500">or</span>
            <div className="flex-1 border-t border-gray-100 dark:border-white/10" />
          </div>

          <form className="flex w-full flex-col" onSubmit={handleSubmit}>
            <div className="mb-4 flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-[13px] text-black dark:text-gray-200">
                Email
              </Label>
              <Input
                type="email"
                id="email"
                placeholder="Type your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="text-gray-900 dark:bg-[#242424] dark:text-gray-100"
              />
            </div>

            <div className="mb-5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[13px] text-black dark:text-gray-200">
                  Password
                </Label>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">At least 8 characters</p>
              </div>
              <Input
                type="password"
                id="password"
                placeholder="Create your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                className="text-gray-900 dark:bg-[#242424] dark:text-gray-100"
              />
            </div>

            <div className="mb-5 flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword" className="text-[13px] text-black dark:text-gray-200">
                Confirm password
              </Label>
              <Input
                type="password"
                id="confirmPassword"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
                className="text-gray-900 dark:bg-[#242424] dark:text-gray-100"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full border-[#141414] bg-[#141414] text-[14px] text-white hover:bg-black focus-visible:ring-[#141414]/24 dark:border-[#f2f2f2] dark:bg-[#f2f2f2] dark:text-[#181818] dark:hover:bg-white dark:focus-visible:ring-white/24"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          {error ? <p className="mt-3 text-[12px] text-red-600">{error}</p> : null}
          {success ? <p className="mt-3 text-[12px] text-emerald-700">{success}</p> : null}

          <p className="mt-5 text-center text-[11px] text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/sign-in" className="font-semibold text-black hover:underline dark:text-gray-100">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden h-full flex-1 p-4 lg:flex lg:p-5">
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[24px] dark:brightness-75"
          style={{
            backgroundColor: '#fdf2f8',
            backgroundImage:
              'radial-gradient(at 0% 0%, hsla(213, 100%, 88%, 1) 0px, transparent 50%), radial-gradient(at 80% 10%, hsla(240, 100%, 94%, 1) 0px, transparent 50%), radial-gradient(at 100% 60%, hsla(330, 100%, 88%, 1) 0px, transparent 50%), radial-gradient(at 30% 90%, hsla(280, 100%, 88%, 1) 0px, transparent 50%), radial-gradient(at 60% 40%, hsla(25, 100%, 88%, 1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(213, 100%, 88%, 1) 0px, transparent 50%)',
          }}
        >
          <div className="absolute -top-20 -left-10 h-96 w-96 rounded-full bg-pink-300 opacity-80 mix-blend-multiply blur-[40px]" />
          <div className="absolute bottom-10 left-20 h-80 w-80 rounded-full bg-orange-200 opacity-80 mix-blend-multiply blur-[40px]" />
          <div className="absolute top-1/2 -right-20 h-[500px] w-[500px] rounded-full bg-blue-300 opacity-80 mix-blend-multiply blur-[40px]" />
          <div className="absolute top-1/3 left-1/4 h-96 w-96 rounded-full bg-white opacity-60 blur-[40px]" />

          <div className="relative z-10 flex w-[85%] max-w-[420px] items-center justify-between rounded-[20px] bg-white/95 p-2 pl-6 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.1)] backdrop-blur-md dark:bg-[#202020]/90 dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.6)]">
            <span className="text-[15px] font-medium text-gray-600 dark:text-gray-300">
              Ask LoveChat to brainstorm ideas
            </span>
            <Button
              type="button"
              size="icon-lg"
              className="rounded-full border-[#1c1c1c] bg-[#1c1c1c] text-white hover:bg-black focus-visible:ring-[#1c1c1c]/24"
              aria-label="Submit prompt"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
