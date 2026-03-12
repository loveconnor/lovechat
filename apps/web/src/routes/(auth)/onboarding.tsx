import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

export const Route = createFileRoute('/(auth)/onboarding')({
	component: OnboardingPage,
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function OnboardingPage() {
	const navigate = useNavigate()
	const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL ?? 'http://localhost:4000', [])
	const [msg11, setMsg11] = useState('')
	const [msg12, setMsg12] = useState('')
	const [msg13, setMsg13] = useState('')
	const [msg21, setMsg21] = useState('')
	const [msg22, setMsg22] = useState('')
	const [msg31, setMsg31] = useState('')
	const [msg32, setMsg32] = useState('')

	const [typingTarget, setTypingTarget] = useState<string | null>(null)

	const [showFormBox, setShowFormBox] = useState(false)
	const [formVisible, setFormVisible] = useState(false)
	const [showNickname, setShowNickname] = useState(false)
	const [showSendBtn, setShowSendBtn] = useState(false)

	const [fullName, setFullName] = useState('')
	const [nickname, setNickname] = useState('')
	const [sendState, setSendState] = useState<'idle' | 'sent'>('idle')

	const [showPolicyBox, setShowPolicyBox] = useState(false)
	const [policyVisible, setPolicyVisible] = useState(false)
	const [showAckBtn, setShowAckBtn] = useState(false)
	const [ackVisible, setAckVisible] = useState(false)
	const [acknowledged, setAcknowledged] = useState(false)

	const [showBullets, setShowBullets] = useState(false)
	const [bulletsVisible, setBulletsVisible] = useState(false)
	const [showStartBtn, setShowStartBtn] = useState(false)
	const [startVisible, setStartVisible] = useState(false)

	const [isBooting, setIsBooting] = useState(true)
	const [isSendingName, setIsSendingName] = useState(false)
	const [isAcknowledging, setIsAcknowledging] = useState(false)
	const [isStartingChat, setIsStartingChat] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)

	const firstName = useMemo(() => fullName.trim().split(' ')[0] ?? '', [fullName])
	const displayName = nickname.trim() || firstName || fullName.trim() || 'Friend'

	useEffect(() => {
		if (!fullName.trim()) {
			setShowNickname(false)
			setShowSendBtn(false)
			setNickname('')
			return
		}

		setShowNickname(true)
		setShowSendBtn(true)
		setNickname(firstName)
	}, [fullName, firstName])

	useEffect(() => {
		let cancelled = false

		async function typeText(
			target: string,
			text: string,
			setter: React.Dispatch<React.SetStateAction<string>>,
			speed = 15,
		) {
			setTypingTarget(target)
			for (const char of text) {
				if (cancelled) {
					return
				}
				setter((prev) => prev + char)
				await sleep(speed)
			}
			if (!cancelled) {
				setTypingTarget(null)
			}
		}

		async function fadeIn(show: () => void, visible: () => void) {
			show()
			await sleep(20)
			if (!cancelled) {
				visible()
			}
			await sleep(500)
		}

		async function boot() {
			await sleep(300)
			await typeText('msg1_1', "Hello, I'm Leo", setMsg11, 25)
			await sleep(400)
			await typeText(
				'msg1_2',
				"I'm an advanced AI assistant built to help you think, create, and build, and I'm trained to be safe, accurate, and secure.",
				setMsg12,
			)
			await sleep(500)
			await typeText(
				'msg1_3',
				"I'd love for us to get to know each other a bit better.",
				setMsg13,
			)
			await sleep(300)
			await fadeIn(() => setShowFormBox(true), () => setFormVisible(true))
			if (!cancelled) {
				setIsBooting(false)
			}
		}

		void boot()

		return () => {
			cancelled = true
		}
	}, [])

	async function persistOnboarding(options: { acknowledged: boolean; completed: boolean }) {
		const sessionToken = window.localStorage.getItem('lovechat_session_token')
		if (!sessionToken) {
			setSaveError('Your session has expired. Please sign in again.')
			return false
		}

		const trimmedFullName = fullName.trim()
		const trimmedNickname = nickname.trim() || firstName || trimmedFullName

		try {
			const response = await fetch(`${apiBaseUrl}/onboarding/profile`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({
					fullName: trimmedFullName,
					nickname: trimmedNickname,
					acknowledged: options.acknowledged,
					completed: options.completed,
				}),
			})

			if (!response.ok) {
				let message = 'Unable to save onboarding details.'
				try {
					const payload = (await response.json()) as { message?: string }
					if (payload.message) {
						message = payload.message
					}
				} catch {
					// Ignore JSON parsing errors and keep fallback message.
				}

				setSaveError(message)
				return false
			}

			window.localStorage.setItem(
				'lovechat_onboarding_profile',
				JSON.stringify({
					fullName: trimmedFullName,
					nickname: trimmedNickname,
				}),
			)

			setSaveError(null)
			return true
		} catch {
			setSaveError('Unable to reach the backend. Check that the API is running.')
			return false
		}
	}

	async function handleSendName() {
		if (!fullName.trim() || isSendingName) {
			return
		}

		setSaveError(null)
		setIsSendingName(true)
		await sleep(600)

		const saved = await persistOnboarding({
			acknowledged: false,
			completed: false,
		})

		if (!saved) {
			setIsSendingName(false)
			return
		}

		setTypingTarget('msg2_1')
		for (const char of `Lovely to meet you, ${displayName}.`) {
			setMsg21((prev) => prev + char)
			await sleep(15)
		}

		setTypingTarget(null)
		await sleep(400)
		setTypingTarget('msg2_2')
		for (const char of 'A few things to know before we start chatting:') {
			setMsg22((prev) => prev + char)
			await sleep(15)
		}

		setTypingTarget(null)
		await sleep(400)
		setShowPolicyBox(true)
		await sleep(20)
		setPolicyVisible(true)
		await sleep(300)
		setShowAckBtn(true)
		await sleep(20)
		setAckVisible(true)
		setIsSendingName(false)
		setSendState('sent')
	}

	async function handleAcknowledge() {
		if (acknowledged || isAcknowledging) {
			return
		}

		setIsAcknowledging(true)
		setAcknowledged(true)
		await sleep(600)

		setTypingTarget('msg3_1')
		for (const char of "And finally, while I strive to do my best in each conversation, I'm not perfect.") {
			setMsg31((prev) => prev + char)
			await sleep(15)
		}

		setTypingTarget(null)
		await sleep(500)
		setTypingTarget('msg3_2')
		for (const char of 'You should keep a few things in mind:') {
			setMsg32((prev) => prev + char)
			await sleep(15)
		}

		setTypingTarget(null)
		await sleep(400)
		setShowBullets(true)
		await sleep(20)
		setBulletsVisible(true)
		await sleep(500)
		setShowStartBtn(true)
		await sleep(20)
		setStartVisible(true)
		setIsAcknowledging(false)
	}

	async function handleStartChatting() {
		if (isStartingChat) {
			return
		}

		setIsStartingChat(true)
		const saved = await persistOnboarding({
			acknowledged,
			completed: true,
		})

		if (!saved) {
			setIsStartingChat(false)
			return
		}

		void navigate({ to: '/chat' })
	}

	return (
		<main className="flex min-h-screen justify-center bg-white px-6 pt-12 pb-24 font-sans text-gray-900 dark:bg-[#181818] dark:text-gray-100 md:px-12">
			<style>{`
				.typing::after {
					content: '|';
					animation: blink 1s step-end infinite;
					margin-left: 2px;
					color: currentColor;
				}
				@keyframes blink {
					0%, 100% { opacity: 1; }
					50% { opacity: 0; }
				}
				.fade-in {
					transition: opacity 0.6s ease-out, transform 0.6s ease-out;
				}
			`}</style>

			<div className="w-full max-w-2xl space-y-10">
				<div className="space-y-6">
					<h1
						className={`min-h-[36px] text-2xl leading-tight font-semibold md:text-3xl ${typingTarget === 'msg1_1' ? 'typing' : ''}`}
					>
						{msg11}
					</h1>
					<p className={`text-[17px] leading-relaxed ${typingTarget === 'msg1_2' ? 'typing' : ''}`}>
						{msg12}
					</p>
					<p className={`text-[17px] leading-relaxed ${typingTarget === 'msg1_3' ? 'typing' : ''}`}>
						{msg13}
					</p>

					<div
						className={`fade-in mt-6 max-w-lg ${showFormBox ? '' : 'hidden'} ${formVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
					>
						<div className="relative min-h-[80px] rounded-xl border border-gray-200 p-5 dark:border-white/10 dark:bg-[#202020]">
							<div className="relative">
								<input
									type="text"
									id="fullName"
									className="peer w-full bg-transparent pt-5 pb-1 text-lg text-gray-900 placeholder-transparent outline-none disabled:text-gray-500 dark:text-gray-100 dark:disabled:text-gray-500"
									placeholder="Nice to meet you, I'm..."
									autoComplete="off"
									value={fullName}
									onChange={(event) => setFullName(event.target.value)}
									disabled={sendState === 'sent'}
								/>
								<label
									htmlFor="fullName"
									className="pointer-events-none absolute top-0 left-0 text-[11px] font-medium text-gray-500 transition-all peer-placeholder-shown:top-1 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:top-0 peer-focus:text-[11px] peer-focus:text-gray-500 dark:text-gray-400 dark:peer-placeholder-shown:text-gray-500 dark:peer-focus:text-gray-400"
								>
									Nice to meet you, I&apos;m...
								</label>
							</div>

							<div
								className={`mt-4 transition-opacity duration-300 ${showNickname ? '' : 'hidden'} ${showNickname ? 'opacity-100' : 'opacity-0'}`}
							>
								<label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">
									But you can call me...
								</label>
								<input
									type="text"
									id="nickName"
									className="w-full bg-transparent text-lg text-gray-900 outline-none disabled:text-gray-500 dark:text-gray-100 dark:disabled:text-gray-500"
									readOnly={sendState === 'sent'}
									tabIndex={-1}
									placeholder=""
									value={nickname}
									onChange={(event) => setNickname(event.target.value)}
									disabled={sendState === 'sent'}
								/>
							</div>

							<button
								type="button"
								onClick={() => void handleSendName()}
								disabled={!fullName.trim() || sendState === 'sent' || isBooting || isSendingName}
								className={`absolute top-4 right-4 flex items-center gap-1.5 rounded px-4 py-2 text-[13px] transition-opacity duration-300 disabled:opacity-50 ${showSendBtn ? '' : 'hidden'} ${showSendBtn ? 'opacity-100' : 'opacity-0'} ${sendState === 'sent' ? 'bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-[#1a1a1a] text-white hover:bg-black dark:bg-[#f2f2f2] dark:text-[#181818] dark:hover:bg-white'}`}
							>
								{sendState === 'sent' ? 'Sent ✓' : 'Send'}
								{sendState === 'sent' ? null : (
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M12 19V5M5 12l7-7 7 7" />
									</svg>
								)}
							</button>
						</div>
						<div className="mt-2 pr-2 text-right text-[10px] text-gray-400 dark:text-gray-500">
							You can always change this later
						</div>
						{saveError ? <p className="mt-3 text-[12px] text-red-600">{saveError}</p> : null}
					</div>
				</div>

				<div className="space-y-6">
					<p className={`text-[17px] leading-relaxed ${typingTarget === 'msg2_1' ? 'typing' : ''}`}>
						{msg21}
					</p>
					<p className={`text-[17px] leading-relaxed ${typingTarget === 'msg2_2' ? 'typing' : ''}`}>
						{msg22}
					</p>

					<div
						className={`fade-in mt-4 flex max-w-2xl flex-col gap-5 rounded-xl border border-gray-200 p-5 dark:border-white/10 dark:bg-[#202020] ${showPolicyBox ? '' : 'hidden'} ${policyVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
					>
						<div className="flex items-start gap-4">
							<div className="flex-shrink-0 rounded-lg bg-[#1a1a1a] p-2.5">
								<svg
									className="h-4 w-4 text-white"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M18 11V6a2 2 0 0 0-4 0v5" />
									<path d="M14 10V4a2 2 0 0 0-4 0v6" />
									<path d="M10 10.5V3a2 2 0 0 0-4 0v9" />
									<path d="M6 13v-1a2 2 0 0 0-4 0v4.5A5.5 5.5 0 0 0 7.5 22h3c2.76 0 5-2.24 5-5v-5a2 2 0 0 0-4 0" />
								</svg>
							</div>
							<p className="pt-0.5 text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">
								LoveChat&apos;s <a href="#" className="underline">Usage Policy</a> prohibits using Hart for
								harm, like producing violent, abusive, or deceptive content.
							</p>
						</div>

						<div className="flex items-start gap-4">
							<div className="flex-shrink-0 rounded-lg bg-[#1a1a1a] p-2.5">
								<svg
									className="h-4 w-4 text-white"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
									<line x1="12" y1="8" x2="12" y2="12" />
									<line x1="12" y1="16" x2="12.01" y2="16" />
								</svg>
							</div>
							<p className="pt-0.5 text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">
								Conversations may be reviewed by automated abuse detection systems to ensure a safe
								environment and help improve my responses.
							</p>
						</div>
					</div>

					<button
						type="button"
						onClick={() => void handleAcknowledge()}
						disabled={!policyVisible || acknowledged || isAcknowledging}
						className={`fade-in flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium dark:border-white/10 dark:bg-[#242424] ${acknowledged ? 'text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-[#242424]' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'} ${showAckBtn ? '' : 'hidden'} ${ackVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
					>
						<svg
							className={`h-4 w-4 ${acknowledged ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							{acknowledged ? (
								<>
									<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
									<polyline points="22 4 12 14.01 9 11.01" />
								</>
							) : (
								<>
									<circle cx="12" cy="12" r="10" />
									<path d="M9 12l2 2 4-4" />
								</>
							)}
						</svg>
						<span>{acknowledged ? 'Acknowledged' : 'Acknowledge and Continue'}</span>
					</button>
				</div>

				<div className="space-y-6">
					<p className={`text-[17px] leading-relaxed ${typingTarget === 'msg3_1' ? 'typing' : ''}`}>
						{msg31}
					</p>
					<p className={`text-[17px] leading-relaxed ${typingTarget === 'msg3_2' ? 'typing' : ''}`}>
						{msg32}
					</p>

					<ul
						className={`fade-in list-disc space-y-4 pt-2 pl-5 text-[17px] leading-relaxed ${showBullets ? '' : 'hidden'} ${bulletsVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
					>
						<li>
							<b>I can make mistakes.</b> I occasionally generate incorrect or misleading information.
							Please double-check important facts.
						</li>
						<li>
							<b>I don&apos;t know everything.</b> My knowledge is based on the data I was trained on,
							and I might not always have the most up-to-date information.
						</li>
					</ul>

					<button
						type="button"
						onClick={() => void handleStartChatting()}
						disabled={isStartingChat}
						className={`fade-in mt-8 w-full rounded-lg bg-[#1a1a1a] py-3.5 font-medium text-white transition-colors hover:bg-black dark:bg-[#f2f2f2] dark:text-[#181818] dark:hover:bg-white ${showStartBtn ? '' : 'hidden'} ${startVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
					>
						{isStartingChat ? 'Saving...' : 'Let&apos;s Start Chatting'}
					</button>
				</div>
			</div>
		</main>
	)
}
