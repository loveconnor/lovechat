import { useEffect, useRef, useState } from 'react'
import {
  MODEL_SETTINGS_UPDATED_EVENT,
  flattenProviders,
  getVisibleProviders,
  loadModelSettings,
  type ModelEntry,
} from '#/components/ai/model-settings'

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
  const isOllamaModel = modelKey.startsWith('ollama:')
  const ollamaModelName = isOllamaModel ? modelKey.slice('ollama:'.length).toLowerCase() : ''
  const isOpenAIOssOnOllama = isOllamaModel && ollamaModelName.startsWith('gpt-oss')
  const isGoogleModelOnOllama =
    isOllamaModel
    && !isOpenAIOssOnOllama
    && ['gemma', 'codegemma', 'paligemma', 'recurrentgemma', 'shieldgemma', 'medgemma', 'gemini'].some((name) => ollamaModelName.includes(name))

  if (isGoogleModelOnOllama) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M23 12.245c0-.905-.075-1.565-.236-2.25h-10.54v4.083h6.186c-.124 1.014-.797 2.542-2.294 3.569l-.021.136 3.332 2.53.23.022C21.779 18.417 23 15.593 23 12.245z" fill="#4285F4" />
        <path d="M12.225 23c3.03 0 5.574-.978 7.433-2.665l-3.542-2.688c-.948.648-2.22 1.1-3.891 1.1a6.745 6.745 0 01-6.386-4.572l-.132.011-3.465 2.628-.045.124C4.043 20.531 7.835 23 12.225 23z" fill="#34A853" />
        <path d="M5.84 14.175A6.65 6.65 0 015.463 12c0-.758.138-1.491.361-2.175l-.006-.147-3.508-2.67-.115.054A10.831 10.831 0 001 12c0 1.772.436 3.447 1.197 4.938l3.642-2.763z" fill="#FBBC05" />
        <path d="M12.225 5.253c2.108 0 3.529.892 4.34 1.638l3.167-3.031C17.787 2.088 15.255 1 12.225 1 7.834 1 4.043 3.469 2.197 7.062l3.63 2.763a6.77 6.77 0 016.398-4.572z" fill="#EB4335" />
      </svg>
    )
  }

  if (isOllamaModel && !isOpenAIOssOnOllama) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 ${isActive ? 'text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
        aria-hidden="true"
      >
        <path d="M4 6h16v12H4z" />
        <path d="M8 10h8" />
        <path d="M8 14h5" />
      </svg>
    )
  }

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

function ProviderTabLogo({ providerKey, isActive }: { providerKey: string; isActive: boolean }) {
  const colorClass = isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'

  if (providerKey === 'ollama') {
    return (
      <svg
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        className={`h-3.5 w-3.5 shrink-0 ${colorClass}`}
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M168.64 23.253c4.608 1.814 8.768 4.8 12.544 8.747 6.293 6.528 11.605 15.872 15.659 26.944 4.074 11.136 6.72 23.467 7.722 35.84a107.824 107.824 0 0143.712-13.568l1.088-.085c18.56-1.494 36.907 1.856 52.907 10.112a103.091 103.091 0 016.336 3.626c1.067-12.138 3.669-24.192 7.68-35.072 4.053-11.093 9.365-20.416 15.637-26.965a35.628 35.628 0 0112.566-8.747c5.482-2.133 11.306-2.517 16.981-.896 8.555 2.432 15.893 7.851 21.675 15.723 5.29 7.19 9.258 16.405 11.968 27.456 4.906 19.925 5.76 46.144 2.453 77.76l1.131.853.554.406c16.15 12.288 27.392 29.802 33.344 50.133 9.28 31.723 4.608 67.307-11.392 87.211l-.384.448.043.064c8.896 16.256 14.293 33.429 15.445 51.2l.043.64c1.365 22.72-4.267 45.589-17.365 68.053l-.15.213.214.512c10.069 24.683 13.226 49.536 9.344 74.368l-.128.832a13.888 13.888 0 01-15.936 11.435 13.83 13.83 0 01-11.31-10.43 13.828 13.828 0 01-.21-5.399c3.562-22.038.213-44.139-10.24-66.624a13.713 13.713 0 01.853-13.163l.085-.128c12.886-19.712 18.219-39.04 17.067-58.027-.981-16.618-6.933-32.938-17.067-48.49a13.737 13.737 0 013.84-18.902l.192-.128c5.184-3.392 9.963-12.053 12.374-23.893a90.218 90.218 0 00-2.027-42.112c-4.373-14.933-12.373-27.392-23.573-35.904-12.694-9.685-29.504-14.357-50.774-13.013a13.93 13.93 0 01-13.482-7.915c-6.699-14.187-16.47-24.341-28.651-30.635a70.145 70.145 0 00-37.803-7.082c-26.56 2.112-49.984 17.088-56.96 35.968a13.91 13.91 0 01-13.013 9.066c-22.763.043-40.384 5.376-53.269 14.998-11.136 8.32-18.731 19.946-22.742 33.877a86.824 86.824 0 00-1.45 40.235c2.389 11.904 7.061 21.76 12.416 27.072l.17.149c4.523 4.416 5.483 11.307 2.326 16.747-7.68 13.269-13.419 33.045-14.358 52.053-1.066 21.717 3.968 40.576 15.339 54.101l.341.406a13.711 13.711 0 012.027 14.72c-12.288 26.368-16.064 48.042-11.989 65.109a13.91 13.91 0 01-27.072 6.357c-5.184-21.717-1.664-46.592 10.09-74.624l.299-.746-.17-.256a92.574 92.574 0 01-12.758-27.926l-.107-.405a122.965 122.965 0 01-3.776-38.08c.939-19.413 5.931-39.296 13.27-55.253l.256-.555-.043-.043c-6.25-8.917-10.88-20.33-13.44-32.96l-.107-.512a114.176 114.176 0 011.984-53.12c5.59-19.52 16.576-36.288 32.768-48.405 1.28-.96 2.624-1.92 3.968-2.816-3.392-31.851-2.538-58.24 2.39-78.293 2.709-11.051 6.698-20.267 11.989-27.456 5.76-7.851 13.099-13.27 21.653-15.723 5.675-1.621 11.52-1.259 17.003.896v.021zm87.808 193.92c19.968 0 38.4 6.678 52.181 18.24 13.44 11.243 21.44 26.347 21.44 41.387 0 18.944-8.661 33.707-24.17 43.136-13.227 8-30.955 11.883-51.264 11.883-21.526 0-39.915-5.526-53.184-15.659-13.163-10.027-20.544-24.107-20.544-39.36 0-15.083 8.49-30.229 22.528-41.515 14.25-11.456 33.066-18.112 53.013-18.112zm0 19.115a65.498 65.498 0 00-40.875 13.867c-9.834 7.893-15.402 17.813-15.402 26.666 0 9.131 4.48 17.686 13.013 24.192 9.707 7.403 23.979 11.691 41.451 11.691 17.045 0 31.424-3.136 41.216-9.088 9.877-5.973 14.933-14.635 14.933-26.816 0-9.024-5.248-18.987-14.571-26.795-10.325-8.64-24.32-13.717-39.765-13.717zm14.123 25.813l.085.086a7.431 7.431 0 01-1.195 10.453l-6.229 4.907v9.514a7.999 7.999 0 01-8.021 7.958 8.004 8.004 0 01-8.022-7.958v-9.813l-5.781-4.651a7.4 7.4 0 01-1.109-10.453 7.53 7.53 0 0110.538-1.088l4.587 3.669 4.693-3.712a7.533 7.533 0 0110.454 1.088zm-107.52-40.938c10.197 0 18.496 8.32 18.496 18.581a18.564 18.564 0 01-18.518 18.581 18.559 18.559 0 01-18.496-18.56 18.565 18.565 0 015.399-13.129 18.609 18.609 0 0113.119-5.473zm185.728 0c10.24 0 18.517 8.32 18.517 18.581a18.559 18.559 0 01-18.517 18.581 18.56 18.56 0 01-18.496-18.56 18.56 18.56 0 0118.496-18.602zM158.72 49.067l-.064.042a14.06 14.06 0 00-6.08 5.078l-.107.128c-2.944 4.032-5.504 9.962-7.424 17.749-3.626 14.763-4.608 34.795-2.645 59.349 9.173-2.73 19.179-4.437 29.952-5.056l.213-.021.406-.725a69.41 69.41 0 013.157-5.099c2.624-16.448.469-36.096-5.397-52.139-2.859-7.765-6.336-13.866-9.664-17.344a13.403 13.403 0 00-2.283-1.92l-.064-.042zm195.712.853l-.043.021a13.396 13.396 0 00-2.282 1.92c-3.328 3.478-6.827 9.6-9.664 17.366-6.187 16.938-8.256 37.888-4.907 54.869l1.237 2.069.171.299h.64a110.599 110.599 0 0131.275 4.523c1.834-23.979.81-43.584-2.731-58.07-1.92-7.786-4.48-13.717-7.445-17.749l-.086-.128a14.054 14.054 0 00-6.08-5.099h-.085v-.021z"
          fill="currentColor"
        />
      </svg>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 640 640"
      fill="currentColor"
      className={`shrink-0 ${colorClass}`}
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
              className="lovechat-accent-focus w-full rounded-[12px] border border-[#E5E5E5] bg-[#F9FAFB] py-2 pl-8 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 transition-all focus:outline-none dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-gray-100"
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
