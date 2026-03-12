import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

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

          <button
            type="button"
            className="mb-3 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 py-2.5 transition-colors hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span className="text-[14px] font-medium text-black dark:text-gray-100">Continue with Github</span>
          </button>

          <button
            type="button"
            className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 py-2.5 transition-colors hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            <span className="text-[14px] font-medium text-black dark:text-gray-100">Continue with Google</span>
          </button>

          <div className="mb-6 flex w-full items-center">
            <div className="flex-1 border-t border-gray-100 dark:border-white/10" />
            <span className="px-3 text-[11px] font-medium text-gray-400 lowercase dark:text-gray-500">or</span>
            <div className="flex-1 border-t border-gray-100 dark:border-white/10" />
          </div>

          <form className="flex w-full flex-col" onSubmit={handleSubmit}>
            <div className="mb-4 flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] text-black dark:text-gray-200">
                Email
              </label>
              <input
                type="email"
                id="email"
                placeholder="Type your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[14px] text-gray-900 placeholder-gray-300 transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:outline-none dark:border-white/10 dark:bg-[#242424] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-white/20 dark:focus:ring-white/20"
              />
            </div>

            <div className="mb-5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[13px] text-black dark:text-gray-200">
                  Password
                </label>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">At least 8 characters</p>
              </div>
              <input
                type="password"
                id="password"
                placeholder="Create your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[14px] text-gray-900 placeholder-gray-300 transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:outline-none dark:border-white/10 dark:bg-[#242424] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-white/20 dark:focus:ring-white/20"
              />
            </div>

            <div className="mb-5 flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-[13px] text-black dark:text-gray-200">
                Confirm password
              </label>
              <input
                type="password"
                id="confirmPassword"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[14px] text-gray-900 placeholder-gray-300 transition-colors focus:border-gray-400 focus:ring-1 focus:ring-gray-400 focus:outline-none dark:border-white/10 dark:bg-[#242424] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-white/20 dark:focus:ring-white/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#141414] py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#f2f2f2] dark:text-[#181818] dark:hover:bg-white"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
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
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1c1c1c] text-white transition-colors hover:bg-black"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
