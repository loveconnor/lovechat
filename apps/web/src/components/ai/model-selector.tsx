import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'love-ui/icons'
import { GoogleIcon, OpenAI } from 'love-ui/logos'
import {
  MODEL_SETTINGS_UPDATED_EVENT,
  flattenProviders,
  getVisibleProviders,
  loadModelSettings,
  type ModelEntry,
} from '#/components/ai/model-settings'
import { OllamaIcon } from '#/components/ai/ollama-icon'
import { Input } from '#/components/ui/input'

type Badge = {
  label: string
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow'
}

const badgeStyles: Record<Badge['color'], string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50',
  green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800/50',
  purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/50',
  orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800/50',
  yellow: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-800/50',
}

function ModelLogo({ isActive, modelKey }: { isActive: boolean; modelKey: string }) {
  const isOllamaModel = modelKey.startsWith("ollama:")
  const ollamaModelName = isOllamaModel ? modelKey.slice("ollama:".length).toLowerCase() : ""
  const isOpenAIOssOnOllama = isOllamaModel && ollamaModelName.startsWith("gpt-oss")
  const isGoogleModelOnOllama =
    isOllamaModel
    && !isOpenAIOssOnOllama
    && ["gemma", "codegemma", "paligemma", "recurrentgemma", "shieldgemma", "medgemma", "gemini"].some((name) => ollamaModelName.includes(name))
  const colorClass = isActive ? "text-black dark:text-white" : "text-gray-500 dark:text-gray-400"

  if (isGoogleModelOnOllama) {
    return <GoogleIcon size={16} className="shrink-0" aria-hidden="true" />
  }

  if (isOllamaModel && !isOpenAIOssOnOllama) {
    return <OllamaIcon size={16} className={"shrink-0 " + colorClass} aria-hidden="true" />
  }

  return <OpenAI size={16} className={"shrink-0 " + colorClass} aria-hidden="true" />
}

function ProviderTabLogo({ providerKey, isActive }: { providerKey: string; isActive: boolean }) {
  const colorClass = isActive ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"

  if (providerKey === "ollama") {
    return <OllamaIcon size={14} className={"shrink-0 " + colorClass} aria-hidden="true" />
  }

  return <OpenAI size={14} className={"shrink-0 " + colorClass} aria-hidden="true" />
}

type ModelSelectorProps = {
  selectedModel: string
  onModelChange: (model: string) => void
}

const hydrationSafeModelKey = 'gpt-5'

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [modelSettings, setModelSettings] = useState(() => loadModelSettings())
  const [hasHydrated, setHasHydrated] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const providers = getVisibleProviders(modelSettings)
  const [activeProvider, setActiveProvider] = useState(providers[0]?.key ?? 'openai')
  const [search, setSearch] = useState('')
  const [detailsModel, setDetailsModel] = useState<ModelEntry | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelShiftX, setPanelShiftX] = useState(0)

  const allModels = flattenProviders(providers)
  const activeModels = search
    ? allModels.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
    : (providers.find((p) => p.key === activeProvider)?.models ?? [])

  const renderModelKey = hasHydrated ? selectedModel : hydrationSafeModelKey
  const selectedTitle = allModels.find((m) => m.key === renderModelKey)?.title ?? renderModelKey

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  useEffect(() => {
    function updateFromStorage() {
      setModelSettings(loadModelSettings())
    }

    window.addEventListener('storage', updateFromStorage)
    window.addEventListener(MODEL_SETTINGS_UPDATED_EVENT, updateFromStorage)

    return () => {
      window.removeEventListener('storage', updateFromStorage)
      window.removeEventListener(MODEL_SETTINGS_UPDATED_EVENT, updateFromStorage)
    }
  }, [])

  useEffect(() => {
    if (providers.length === 0) {
      return
    }

    if (!providers.some((provider) => provider.key === activeProvider)) {
      setActiveProvider(providers[0].key)
    }
  }, [activeProvider, providers])

  useEffect(() => {
    if (allModels.length === 0) {
      return
    }

    if (!allModels.some((model) => model.key === selectedModel)) {
      onModelChange(allModels[0].key)
    }
  }, [allModels, onModelChange, selectedModel])

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 639px)')
    const onMediaChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches)
    }

    setIsMobileViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', onMediaChange)

    return () => {
      mediaQuery.removeEventListener('change', onMediaChange)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setPanelShiftX(0)
      return
    }

    if (isMobileViewport) {
      setPanelShiftX(0)
      return
    }

    function updatePanelPosition() {
      const panel = panelRef.current
      if (!panel) {
        return
      }

      const viewportPadding = 8

      // Measure first without translation, then shift only when clipping would happen.
      panel.style.transform = 'translateX(0px)'
      const bounds = panel.getBoundingClientRect()

      let nextShift = 0
      if (bounds.left < viewportPadding) {
        nextShift += viewportPadding - bounds.left
      }

      if (bounds.right > window.innerWidth - viewportPadding) {
        nextShift -= bounds.right - (window.innerWidth - viewportPadding)
      }

      setPanelShiftX(nextShift)
    }

    const raf = window.requestAnimationFrame(updatePanelPosition)
    window.addEventListener('resize', updatePanelPosition)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', updatePanelPosition)
    }
  }, [isOpen, isMobileViewport, search, activeProvider])

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
        <ModelLogo isActive={false} modelKey={renderModelKey} />
        <span>{selectedTitle}</span>
        <ChevronDown
          className={`mt-[1px] size-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          style={isMobileViewport ? undefined : { transform: `translateX(${panelShiftX}px)` }}
          className={`z-[100] flex flex-col border border-[#E5E5E5] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border-gray-700 dark:bg-[#212121] ${
            isMobileViewport
              ? 'fixed inset-x-2 bottom-24 max-h-[52vh] rounded-[18px] p-2'
              : 'absolute right-0 bottom-full mb-2 w-[min(360px,calc(100vw-1rem))] max-w-[360px] rounded-[20px] p-2.5 sm:rounded-[24px] sm:p-3'
          }`}
        >
          {/* Search */}
          <div className="relative mb-2.5 sm:mb-3">
            <Search
              className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              size="sm"
              className="bg-[#F9FAFB] text-[13px] text-gray-900 dark:bg-[#1a1a1a] dark:text-gray-100 [&_[data-slot=input]]:py-2 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:pr-3"
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
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[13px] font-semibold transition-all focus:outline-none ${
                    activeProvider === p.key
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-[#3f3f3f] dark:text-white'
                      : 'bg-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  <ProviderTabLogo providerKey={p.key} isActive={activeProvider === p.key} />
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Model List */}
          <div className={`flex flex-col gap-2 overflow-y-auto pr-1.5 sm:pr-3 [scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent] dark:[scrollbar-color:#4b5563_transparent] ${isMobileViewport ? 'max-h-[calc(52vh-86px)]' : 'max-h-[min(56vh,340px)]'}`}>
            {activeModels.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#E5E5E5] px-4 py-6 text-center text-[13px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No models are visible. Enable at least one model in Settings → Models.
              </div>
            ) : null}

            {activeModels.map((model) => {
              const isSelected = model.key === selectedModel
              return (
                <div
                  key={model.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(model.key)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelect(model.key)}
                  className={`flex w-full cursor-pointer flex-col rounded-[14px] border p-3 text-left transition-all focus:outline-none sm:rounded-[16px] sm:p-3.5 ${
                    isSelected
                      ? 'border-[#E5E5E5] bg-white shadow-sm dark:border-gray-600 dark:bg-[#2f2f2f]'
                      : 'border-transparent hover:bg-[#F9FAFB] dark:hover:bg-[#2f2f2f]'
                  }`}
                >
                  <div className="mb-1.5 flex w-full items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ModelLogo isActive={isSelected} modelKey={model.key} />
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
                    <Check
                      className={`size-4 text-black dark:text-white ${isSelected ? '' : 'hidden'}`}
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mb-2 line-clamp-2 text-[12px] leading-snug text-gray-500 sm:text-[13px] dark:text-gray-400">{model.desc}</div>
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
                      className="lovechat-accent-surface ml-auto rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors dark:text-gray-400"
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
                <X className="size-[18px]" />
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
                className="lovechat-accent-button rounded-[12px] px-5 py-2.5 text-[14px] font-medium shadow-sm transition-colors focus:outline-none"
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
