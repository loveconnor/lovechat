import { useEffect, useRef, useState } from 'react'

type Badge = {
  label: string
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow'
}

type ModelDetail = {
  provider: string
  context: string
  desc: string
  strengths: string[]
  useCases: string
}

type ModelEntry = {
  key: string
  title: string
  desc: string
  context: string
  badges: Badge[]
  details: ModelDetail
}

type Provider = {
  key: string
  label: string
  models: ModelEntry[]
}

const badgeStyles: Record<Badge['color'], string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50',
  green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800/50',
  purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/50',
  orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800/50',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-800/50',
}

// To add a new provider, append an entry to this array.
const providers: Provider[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    models: [
      {
        key: 'gpt-5.4',
        title: 'GPT-5.4',
        desc: 'OpenAI’s latest flagship model for complex reasoning and coding.',
        context: '1M Context',
        badges: [{ label: 'Flagship', color: 'purple' }],
        details: {
          provider: 'OpenAI',
          context: '1,000,000 tokens',
          desc: 'GPT-5.4 is OpenAI’s newest frontier model designed for complex reasoning, coding, and AI agents. It supports massive context windows and native computer-use capabilities.',
          strengths: [
            'Best reasoning and coding performance',
            'Massive long-context support',
            'Agent workflows and tool usage'
          ],
          useCases:
            'AI agents, complex reasoning, large codebases, professional workflows.'
        }
      },

      {
        key: 'gpt-5',
        title: 'GPT-5',
        desc: 'High-intelligence model for coding and advanced logic.',
        context: '400k Context',
        badges: [{ label: 'Advanced', color: 'blue' }],
        details: {
          provider: 'OpenAI',
          context: '400,000 tokens',
          desc: 'GPT-5 is a powerful model for complex reasoning, coding, and agentic workflows. It supports configurable reasoning effort for deeper problem solving.',
          strengths: [
            'Advanced reasoning',
            'Excellent coding ability',
            'Tool and agent workflows'
          ],
          useCases:
            'Engineering tasks, research, complex analysis.'
        }
      },

      {
        key: 'gpt-5-mini',
        title: 'GPT-5 Mini',
        desc: 'Balanced model with strong reasoning at lower cost.',
        context: '400k Context',
        badges: [{ label: 'Balanced', color: 'green' }],
        details: {
          provider: 'OpenAI',
          context: '400,000 tokens',
          desc: 'GPT-5 Mini provides strong reasoning capabilities at significantly lower cost and latency than the full GPT-5 model.',
          strengths: [
            'Good reasoning performance',
            'Faster and cheaper than GPT-5',
            'Strong conversational ability'
          ],
          useCases:
            'Chatbots, SaaS assistants, business workflows.'
        }
      },

      {
        key: 'gpt-5-nano',
        title: 'GPT-5 Nano',
        desc: 'Ultra-fast, low-cost model for simple AI tasks.',
        context: '400k Context',
        badges: [{ label: 'Cheap', color: 'yellow' }],
        details: {
          provider: 'OpenAI',
          context: '400,000 tokens',
          desc: 'GPT-5 Nano is the fastest and cheapest GPT-5 model, optimized for simple and high-volume tasks.',
          strengths: [
            'Very low cost',
            'Fast inference',
            'Efficient for repeated tasks'
          ],
          useCases:
            'Classification, summarization, tagging, lightweight assistants.'
        }
      },

      {
        key: 'o3',
        title: 'o3',
        desc: 'Advanced reasoning model for complex problem solving.',
        context: '200k Context',
        badges: [{ label: 'Reasoning', color: 'orange' }],
        details: {
          provider: 'OpenAI',
          context: '200,000 tokens',
          desc: 'o3 is a specialized reasoning model designed for complex multi-step logic and analysis.',
          strengths: [
            'Deep reasoning',
            'Step-by-step analysis',
            'Strong math and logic ability'
          ],
          useCases:
            'Math, planning, research, advanced reasoning.'
        }
      },

      {
        key: 'o4-mini',
        title: 'o4-mini',
        desc: 'Fast reasoning model optimized for efficiency.',
        context: '200k Context',
        badges: [{ label: 'Reasoning', color: 'orange' }, { label: 'Fast', color: 'green' }],
        details: {
          provider: 'OpenAI',
          context: '200,000 tokens',
          desc: 'o4-mini is a lightweight reasoning model optimized for speed and cost.',
          strengths: [
            'Fast reasoning',
            'Lower cost',
            'Efficient multi-step logic'
          ],
          useCases:
            'Planning tasks, analysis pipelines, logic-heavy automation.'
        }
      }
    ]
  }
]

function OpenAILogo({ isActive }: { isActive: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 640 640"
      fill="currentColor"
      className={`shrink-0 ${isActive ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
      aria-hidden="true"
    >
      <path d="M260.4 249.8L260.4 201.2C260.4 197.1 261.9 194 265.5 192L363.3 135.7C376.6 128 392.5 124.4 408.9 124.4C470.3 124.4 509.3 172 509.3 222.7C509.3 226.3 509.3 230.4 508.8 234.5L407.3 175.1C401.2 171.5 395 171.5 388.9 175.1L260.4 249.8zM488.7 439.2L488.7 323C488.7 315.8 485.6 310.7 479.5 307.1L351 232.4L393 208.3C396.6 206.3 399.7 206.3 403.2 208.3L501 264.7C529.2 281.1 548.1 315.9 548.1 349.7C548.1 388.6 525.1 424.5 488.7 439.3L488.7 439.3zM230.2 336.8L188.2 312.2C184.6 310.2 183.1 307.1 183.1 303L183.1 190.4C183.1 135.6 225.1 94.1 281.9 94.1C303.4 94.1 323.4 101.3 340.3 114.1L239.4 172.5C233.3 176.1 230.2 181.2 230.2 188.4L230.2 336.9L230.2 336.9zM320.6 389L260.4 355.2L260.4 283.5L320.6 249.7L380.8 283.5L380.8 355.2L320.6 389zM359.3 544.7C337.8 544.7 317.8 537.5 300.9 524.7L401.8 466.3C407.9 462.7 411 457.6 411 450.4L411 301.9L453.5 326.5C457.1 328.5 458.6 331.6 458.6 335.7L458.6 448.3C458.6 503.1 416.1 544.6 359.3 544.6L359.3 544.6zM237.8 430.5L140.1 374.2C111.9 357.8 93 323 93 289.2C93 249.8 116.6 214.4 152.9 199.6L152.9 316.3C152.9 323.5 156 328.6 162.1 332.2L290.1 406.4L248.1 430.5C244.5 432.5 241.4 432.5 237.9 430.5zM232.2 514.5C174.3 514.5 131.8 471 131.8 417.2C131.8 413.1 132.3 409 132.8 404.9L233.7 463.3C239.8 466.9 246 466.9 252.1 463.3L380.6 389.1L380.6 437.7C380.6 441.8 379.1 444.9 375.5 446.9L277.7 503.2C264.4 510.9 248.5 514.5 232.1 514.5L232.1 514.5zM359.2 575.4C421.2 575.4 472.9 531.4 484.6 473C541.9 458.1 578.8 404.4 578.8 349.6C578.8 313.8 563.4 278.9 535.8 253.9C538.4 243.1 539.9 232.4 539.9 221.6C539.9 148.4 480.5 93.6 411.9 93.6C398.1 93.6 384.8 95.6 371.5 100.3C348.5 77.8 316.7 63.4 281.9 63.4C219.9 63.4 168.2 107.4 156.5 165.8C99.2 180.6 62.3 234.4 62.3 289.2C62.3 325 77.7 359.9 105.3 384.9C102.7 395.7 101.2 406.4 101.2 417.2C101.2 490.4 160.6 545.2 229.2 545.2C243 545.2 256.3 543.2 269.6 538.5C292.6 561 324.4 575.4 359.2 575.4z" />
    </svg>
  )
}

type ModelSelectorProps = {
  selectedModel: string
  onModelChange: (model: string) => void
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeProvider, setActiveProvider] = useState(providers[0].key)
  const [search, setSearch] = useState('')
  const [detailsModel, setDetailsModel] = useState<ModelEntry | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const allModels = providers.flatMap((p) => p.models)
  const activeModels = search
    ? allModels.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
    : (providers.find((p) => p.key === activeProvider)?.models ?? [])

  const selectedTitle = allModels.find((m) => m.key === selectedModel)?.title ?? selectedModel

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  function handleSelect(modelKey: string) {
    onModelChange(modelKey)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 py-1 text-[13px] font-medium text-[#6B7280] transition-colors hover:text-gray-900 focus:outline-none dark:text-gray-400 dark:hover:text-gray-100"
      >
        <OpenAILogo isActive={false} />
        <span>{selectedTitle}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`mt-[1px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 bottom-full z-[100] mb-2 flex w-[360px] flex-col rounded-[24px] border border-[#E5E5E5] bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border-gray-700 dark:bg-[#212121]">
          {/* Search */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full rounded-[12px] border border-[#E5E5E5] bg-[#F9FAFB] py-2 pl-8 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
          </div>

          {/* Provider Tabs — only shown when not searching */}
          {!search && (
            <div className="mb-3 flex items-center rounded-[12px] bg-[#F3F4F6] p-1 dark:bg-[#1a1a1a]">
              {providers.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setActiveProvider(p.key)}
                  className={`flex-1 rounded-[8px] px-2 py-1.5 text-[13px] font-semibold transition-all focus:outline-none ${
                    activeProvider === p.key
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-[#3f3f3f] dark:text-white'
                      : 'bg-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Model List */}
          <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-3 [scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent] dark:[scrollbar-color:#4b5563_transparent]">
            {activeModels.map((model) => {
              const isSelected = model.key === selectedModel
              return (
                <div
                  key={model.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(model.key)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelect(model.key)}
                  className={`flex w-full cursor-pointer flex-col rounded-[16px] border p-3.5 text-left transition-all focus:outline-none ${
                    isSelected
                      ? 'border-[#E5E5E5] bg-white shadow-sm dark:border-gray-600 dark:bg-[#2f2f2f]'
                      : 'border-transparent hover:bg-[#F9FAFB] dark:hover:bg-[#2f2f2f]'
                  }`}
                >
                  <div className="mb-1.5 flex w-full items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <OpenAILogo isActive={isSelected} />
                      <span
                        className={`text-[15px] transition-colors ${
                          isSelected
                            ? 'font-semibold text-gray-900 dark:text-white'
                            : 'font-medium text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {model.title}
                      </span>
                    </div>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-black dark:text-white ${isSelected ? '' : 'hidden'}`}
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="mb-2 text-[13px] leading-snug text-gray-500 dark:text-gray-400">{model.desc}</div>
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[#E5E5E5] px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:border-gray-600 dark:text-gray-300">
                      {model.context}
                    </span>
                    {model.badges.map((b) => (
                      <span key={b.label} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${badgeStyles[b.color]}`}>
                        {b.label}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailsModel(model)
                      }}
                      className="ml-auto rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                    >
                      Details
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsModel && (
        <div
          role="presentation"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/60"
          onClick={() => setDetailsModel(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${detailsModel.title} details`}
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-transparent bg-white shadow-2xl dark:border-gray-700 dark:bg-[#2f2f2f]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E5E5] p-5 dark:border-gray-700">
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">{detailsModel.title}</h3>
              <button
                type="button"
                onClick={() => setDetailsModel(null)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-gray-100"
                aria-label="Close details"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-5 p-6">
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Description</h4>
                <p className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-300">{detailsModel.details.desc}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Provider</h4>
                  <p className="text-[14px] font-medium text-gray-900 dark:text-gray-100">{detailsModel.details.provider}</p>
                </div>
                <div>
                  <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Context Window</h4>
                  <p className="text-[14px] font-medium text-gray-900 dark:text-gray-100">{detailsModel.details.context}</p>
                </div>
              </div>
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Key Strengths</h4>
                <ul className="list-disc space-y-1 pl-4 text-[14px] text-gray-700 marker:text-gray-400 dark:text-gray-300 dark:marker:text-gray-500">
                  {detailsModel.details.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Ideal Use Cases</h4>
                <p className="text-[14px] leading-relaxed text-gray-700 dark:text-gray-300">{detailsModel.details.useCases}</p>
              </div>
            </div>
            <div className="flex justify-end border-t border-[#E5E5E5] p-5 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  handleSelect(detailsModel.key)
                  setDetailsModel(null)
                }}
                className="rounded-[12px] bg-blue-600 px-5 py-2.5 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none"
              >
                Select Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
