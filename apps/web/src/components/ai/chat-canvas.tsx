import { Check, Copy, Download, History, Share, Square, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeBlockIcon, CodeblockShiki } from '@/components/ui/code-block'
import type { Languages as ShikiLanguage } from '@/components/ui/code-block'

type CanvasCodeBlockProps = {
  question: string
  code: string
  onPreview: () => void
}

type CanvasPreviewPanelProps = {
  question: string
  code: string
  versions?: CanvasVersionEntry[]
  onRestoreVersion?: (version: CanvasVersionEntry) => void
  isUpdating?: boolean
  isMobileLayout: boolean
  onClose: () => void
}

export type CanvasVersionEntry = {
  id: string
  label: string
  question: string
  code: string
}

export const defaultCanvasCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Modern Landing Page</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; }
    .container { width: min(1120px, 92%); margin: 0 auto; }
  </style>
</head>
<body>
  <!-- Page content -->
</body>
</html>`

function extractPreviewHtml(code: string) {
  const normalized = code.trim()
  if (!normalized) {
    return {
      styles: '',
      bodyHtml: '<main style="padding: 2rem; color: #111827; font-family: Inter, sans-serif;">No preview content available.</main>',
      title: 'Preview',
    }
  }

  const styleMatches = [...normalized.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
  const styles = styleMatches.map((match) => match[1]?.trim() || '').filter(Boolean).join('\n\n')

  const linkMatches = [...normalized.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi)]
  const stylesheetLinks = linkMatches.map((match) => match[0]).join('\n')

  const bodyTagMatch = normalized.match(/<body([^>]*)>/i)
  const bodyClassMatch = bodyTagMatch?.[1]?.match(/class=["']([^"']*)["']/i)
  const bodyClass = bodyClassMatch?.[1]?.trim() || ''

  const bodyMatch = normalized.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyHtml = bodyMatch?.[1]?.trim() || normalized

  const titleMatch = normalized.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch?.[1]?.trim() || 'Preview'

  return {
    bodyClass,
    stylesheetLinks,
    styles,
    bodyHtml,
    title,
  }
}

function scopeRootStyles(styles: string) {
  return styles
    .replace(/\bhtml\b/g, '.lovechat-preview-root')
    .replace(/\bbody\b/g, '.lovechat-preview-root')
}

function inferShikiLanguage(code: string): ShikiLanguage {
  const normalized = code.toLowerCase()

  if (normalized.includes('<!doctype html') || normalized.includes('<html')) return 'html'
  if (normalized.includes('import react') || normalized.includes('export default function')) return 'tsx'
  if (normalized.includes('interface ') || normalized.includes('type ') || normalized.includes(': string')) return 'ts'
  if (normalized.includes('const ') || normalized.includes('function ') || normalized.includes('=>')) return 'js'
  if (normalized.includes('{') && normalized.includes('}') && normalized.includes(':') && normalized.includes('"')) return 'json'
  if (normalized.includes('body {') || normalized.includes('@media')) return 'css'
  if (normalized.includes('#!/bin/bash') || normalized.includes('npm ') || normalized.includes('pnpm ')) return 'bash'

  return 'html'
}

function deriveCanvasTitleFromCode(code: string, language: ShikiLanguage) {
  const normalized = code.trim()

  if (language === 'html') {
    const htmlTitleMatch = normalized.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const htmlTitle = htmlTitleMatch?.[1]?.replace(/\s+/g, ' ').trim()
    if (htmlTitle) {
      return htmlTitle
    }

    const h1Match = normalized.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const h1Title = h1Match?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (h1Title) {
      return h1Title
    }
  }

  const functionMatch = normalized.match(/(?:export\s+default\s+)?function\s+([A-Za-z0-9_]+)/)
  if (functionMatch?.[1]) {
    return functionMatch[1]
  }

  const classMatch = normalized.match(/class\s+([A-Za-z0-9_]+)/)
  if (classMatch?.[1]) {
    return classMatch[1]
  }

  if (language === 'css') {
    return 'Stylesheet'
  }

  if (language === 'json') {
    return 'JSON Data'
  }

  return 'Generated Canvas'
}

export function CanvasCodeBlock({ question, code, onPreview }: CanvasCodeBlockProps) {
  const codeScrollAreaRef = useRef<HTMLDivElement | null>(null)
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)
  const [didCopy, setDidCopy] = useState(false)
  const copyResetTimeoutRef = useRef<number | null>(null)
  const language = inferShikiLanguage(code)
  const canvasTitle = deriveCanvasTitleFromCode(code, language)
  const resolvedCanvasTitle = canvasTitle === 'Generated Canvas' && question.trim()
    ? question.trim()
    : canvasTitle

  function getCanvasFilename(selectedLanguage: ShikiLanguage, canvasName: string) {
    const normalizedName = canvasName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const baseName = normalizedName || 'canvas'

    switch (selectedLanguage) {
      case 'html':
        return `${baseName}.html`
      case 'tsx':
        return `${baseName}.tsx`
      case 'ts':
        return `${baseName}.ts`
      case 'js':
        return `${baseName}.js`
      case 'json':
        return `${baseName}.json`
      case 'css':
        return `${baseName}.css`
      case 'bash':
        return `${baseName}.sh`
      default:
        return `${baseName}.txt`
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setDidCopy(true)

      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setDidCopy(false)
      }, 1200)
    } catch {
      // Silently fail to avoid blocking the UI in unsupported clipboard environments.
    }
  }

  function handleDownloadCode() {
    const fileName = getCanvasFilename(language, resolvedCanvasTitle)
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }

  useEffect(() => {
    const element = codeScrollAreaRef.current
    if (!element) {
      return
    }

    const updateIndicator = () => {
      const atBottom = Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10
      const canScroll = element.scrollHeight > element.clientHeight + 12
      setShowScrollIndicator(canScroll && !atBottom)
    }

    updateIndicator()
    element.addEventListener('scroll', updateIndicator)
    window.addEventListener('resize', updateIndicator)

    return () => {
      element.removeEventListener('scroll', updateIndicator)
      window.removeEventListener('resize', updateIndicator)

      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="w-full max-w-[95%]">
      <div className="relative w-full overflow-hidden rounded-[16px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-sm transition-colors dark:border-gray-800 dark:bg-[#0d0d0d] dark:shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] bg-[#F3F4F6] px-4 py-3 transition-colors dark:border-gray-800 dark:bg-[#0d0d0d]">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-gray-800 dark:text-gray-200">{resolvedCanvasTitle}</span>
            <CodeBlockIcon language={language} className="shrink-0" />
          </div>

          <div className="ml-2 flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => void handleCopyCode()}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
              aria-label="Copy code"
              title="Copy code"
            >
              {didCopy ? <Check className="size-[14px] text-green-500" /> : <Copy className="size-[14px]" />}
            </button>
            <button
              type="button"
              onClick={handleDownloadCode}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
              aria-label="Download code"
              title="Download code"
            >
              <Download className="size-[14px]" />
            </button>
            <button
              type="button"
              onClick={onPreview}
              className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3.5 py-1.5 text-[12px] font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-transparent dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Preview
            </button>
          </div>
        </div>

        <div className="relative w-full">
          <div
            ref={codeScrollAreaRef}
            className="no-scrollbar max-h-[340px] overflow-y-auto bg-[#FAFAFA] p-5 text-gray-800 leading-relaxed transition-colors dark:bg-[#0d0d0d] dark:text-gray-300"
          >
            <CodeblockShiki code={code} language={language} className="[&>pre]:m-0 [&>pre]:bg-transparent" />
          </div>

          {showScrollIndicator ? (
            <div className="pointer-events-none absolute right-0 bottom-0 left-0 flex h-28 items-end justify-center bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA]/80 to-transparent pb-4 transition-opacity duration-300 dark:from-[#0d0d0d] dark:via-[#0d0d0d]/80">
              <button
                type="button"
                onClick={() => codeScrollAreaRef.current?.scrollBy({ top: 150, behavior: 'smooth' })}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-gray-500 shadow-md backdrop-blur-md transition-all hover:bg-gray-50 hover:text-gray-800 dark:border-white/10 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20 dark:hover:text-white"
                aria-label="Scroll code down"
              >
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
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CanvasPreviewPanel({
  question,
  code,
  versions = [],
  onRestoreVersion,
  isUpdating = false,
  isMobileLayout,
  onClose,
}: CanvasPreviewPanelProps) {
  const [didCopy, setDidCopy] = useState(false)
  const [didExport, setDidExport] = useState(false)
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false)
  const [activeVersionId, setActiveVersionId] = useState('__current__')
  const versionMenuRef = useRef<HTMLDivElement | null>(null)
  const previewHostRef = useRef<HTMLDivElement | null>(null)
  const copyResetTimeoutRef = useRef<number | null>(null)
  const exportResetTimeoutRef = useRef<number | null>(null)
  const normalizedVersions = useMemo(() => {
    const currentFingerprint = `${question}::${code}`
    const dedupedByFingerprint = new Set<string>([currentFingerprint])
    const dedupedById = new Set<string>()

    return versions.filter((version) => {
      if (!version.id || dedupedById.has(version.id)) {
        return false
      }

      const fingerprint = `${version.question}::${version.code}`
      if (dedupedByFingerprint.has(fingerprint)) {
        return false
      }

      dedupedById.add(version.id)
      dedupedByFingerprint.add(fingerprint)
      return true
    })
  }, [code, question, versions])

  const activeVersion = useMemo(() => {
    if (activeVersionId === '__current__') {
      return {
        id: '__current__',
        label: 'Current',
        question,
        code,
      }
    }

    return normalizedVersions.find((version) => version.id === activeVersionId) ?? {
      id: '__current__',
      label: 'Current',
      question,
      code,
    }
  }, [activeVersionId, code, normalizedVersions, question])

  const previewData = extractPreviewHtml(activeVersion.code)

  useEffect(() => {
    const host = previewHostRef.current
    if (!host) {
      return
    }

    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const shell = document.createElement('div')
    shell.innerHTML = `
      <style>
        :host {
          color-scheme: light dark;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        .lovechat-preview-root {
          min-height: 100%;
          width: 100%;
          color: #111827;
          background: #ffffff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
        }

        @media (prefers-color-scheme: dark) {
          .lovechat-preview-root {
            color: #e5e7eb;
            background: #0a0f1c;
          }
        }

        ${scopeRootStyles(previewData.styles)}
      </style>
      ${previewData.stylesheetLinks}
      <div class="lovechat-preview-root ${previewData.bodyClass}">${previewData.bodyHtml}</div>
    `

    shadowRoot.replaceChildren(shell)
  }, [previewData.bodyClass, previewData.bodyHtml, previewData.styles, previewData.stylesheetLinks])

  useEffect(() => {
    setActiveVersionId('__current__')
  }, [code, question])

  useEffect(() => {
    if (!isVersionMenuOpen) {
      return
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (!versionMenuRef.current) {
        return
      }

      const target = event.target
      if (target instanceof Node && !versionMenuRef.current.contains(target)) {
        setIsVersionMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [isVersionMenuOpen])

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }

      if (exportResetTimeoutRef.current) {
        window.clearTimeout(exportResetTimeoutRef.current)
      }
    }
  }, [])

  async function handleCopyPreviewCode() {
    try {
      await navigator.clipboard.writeText(activeVersion.code)
      setDidCopy(true)

      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }

      copyResetTimeoutRef.current = window.setTimeout(() => {
        setDidCopy(false)
      }, 1200)
    } catch {
      // Ignore clipboard failures on unsupported devices.
    }
  }

  function handleExportPreviewCode() {
    const safeQuestion = activeVersion.question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const fileName = `${safeQuestion || 'canvas-preview'}.html`
    const blob = new Blob([activeVersion.code], { type: 'text/html;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)

    setDidExport(true)
    if (exportResetTimeoutRef.current) {
      window.clearTimeout(exportResetTimeoutRef.current)
    }
    exportResetTimeoutRef.current = window.setTimeout(() => {
      setDidExport(false)
    }, 1200)
  }

  return (
    <section className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden border border-[#E5E5E5] bg-white shadow-sm transition-all duration-300 dark:border-gray-700 dark:bg-[#212121] ${isMobileLayout ? 'fixed inset-x-2 top-16 bottom-2 z-[45] rounded-[24px]' : 'rounded-[24px]'}`}>
      <header className="relative z-10 flex items-center justify-between border-b border-[#E5E5E5] bg-white/80 px-4 py-3 backdrop-blur-sm dark:border-gray-700 dark:bg-[#212121]/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close preview"
          >
            <X className="size-[18px]" />
          </button>
          <span className="px-2 py-1 text-[14px] font-semibold text-gray-900 dark:text-gray-100">
            {previewData.title || 'Landing-page'}
          </span>
        </div>

        <div className="ml-2 flex items-center gap-1 text-gray-500 sm:gap-1.5 dark:text-gray-400">
          <button
            type="button"
            onClick={() => void handleCopyPreviewCode()}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Copy content"
            title="Copy content"
          >
            {didCopy ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
          </button>
          <button
            type="button"
            onClick={handleExportPreviewCode}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Share or export"
            title="Share or export"
          >
            {didExport ? <Check className="size-4 text-green-500" /> : <Share className="size-4" />}
          </button>
          <div ref={versionMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsVersionMenuOpen((previous) => !previous)}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Version history"
              title="Version history"
            >
              <History className="size-4" />
            </button>

            <div
              className={`absolute top-full right-0 z-20 mt-2 w-80 overflow-hidden rounded-[16px] border border-[#E5E5E5] bg-white p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all dark:border-gray-700 dark:bg-[#2f2f2f] ${isVersionMenuOpen ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'}`}
            >
              <div className="border-b border-[#E5E5E5] px-2.5 py-2 text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:border-gray-700 dark:text-gray-400">
                Versions
              </div>

              <div className="max-h-72 overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="rounded-[10px] border border-gray-200 bg-gray-50 px-2.5 py-2 text-[12px] dark:border-gray-700 dark:bg-[#242424]">
                  <p className="truncate font-medium text-gray-800 dark:text-gray-100">Current</p>
                  <p className="truncate text-gray-500 dark:text-gray-400">{question}</p>
                </div>

                {normalizedVersions.length === 0 ? (
                  <p className="px-2.5 py-2 text-[12px] text-gray-500 dark:text-gray-400">No previous canvas versions yet.</p>
                ) : (
                  normalizedVersions.map((version) => (
                    <div
                      key={version.id}
                      className={`mt-1.5 rounded-[10px] border px-2.5 py-2 transition-colors ${activeVersionId === version.id ? 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-[#242424]'}`}
                    >
                      <p className="truncate text-[12px] font-medium text-gray-800 dark:text-gray-100">{version.label}</p>
                      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{version.question}</p>
                      <div className="mt-2 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveVersionId(version.id)
                            setIsVersionMenuOpen(false)
                          }}
                          className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/10"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreVersion?.(version)
                            setActiveVersionId('__current__')
                            setIsVersionMenuOpen(false)
                          }}
                          className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-800 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="mx-1 h-4 w-px bg-[#E5E5E5] dark:bg-gray-700" />
          <button
            type="button"
            onClick={onClose}
            className="ml-1 flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-[13px] font-medium text-gray-800 transition-colors hover:bg-gray-200 dark:bg-[#333333] dark:text-gray-200 dark:hover:bg-[#444444]"
          >
            <Square className="size-3.5" />
            Stop
          </button>
        </div>
      </header>

      <div className="no-scrollbar relative flex-1 overflow-y-auto bg-white p-0 text-gray-900 transition-colors dark:bg-[#0a0f1c] dark:text-white">
        <div ref={previewHostRef} className="min-h-full w-full" />

        {isUpdating ? (
          <>
            <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-[2px] overflow-hidden bg-transparent">
              <div className="h-full w-full animate-pulse bg-gradient-to-r from-blue-500/0 via-blue-500/80 to-blue-500/0" />
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
