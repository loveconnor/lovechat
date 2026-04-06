import { Check, Copy, Download, History, Share, Square, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as ReactRuntime from 'react'
import { createRoot, type Root } from 'react-dom/client'
import * as BabelStandalone from '@babel/standalone'
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

function escapePreviewHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

type ExecutableCanvasLanguage = 'js' | 'ts' | 'tsx'

function decodePreviewHtml(value: string) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
}

function getEmbeddedLegacyCanvasSource(code: string) {
  const titleMatch = code.match(/<title>\s*Canvas from (JS|TS|TSX)\s*<\/title>/i)
  if (!titleMatch) {
    return null
  }

  const preMatch = code.match(/<pre>([\s\S]*?)<\/pre>/i)
  if (!preMatch?.[1]) {
    return null
  }

  const sourceLanguage = titleMatch[1].toLowerCase()
  const language: ExecutableCanvasLanguage =
    sourceLanguage === 'js' ? 'js' : sourceLanguage === 'ts' ? 'ts' : 'tsx'

  return {
    language,
    code: decodePreviewHtml(preMatch[1]),
  }
}

function getBabelFilenameForCanvas(language: ExecutableCanvasLanguage) {
  if (language === 'js') {
    return 'canvas.jsx'
  }

  if (language === 'ts') {
    return 'canvas.ts'
  }

  return 'canvas.tsx'
}

function extractCanvasComponentCandidateNames(code: string) {
  const candidates = new Set<string>()
  const addCandidate = (name: string) => {
    if (/^[A-Z][A-Za-z0-9_]*$/.test(name)) {
      candidates.add(name)
    }
  }

  const functionMatches = code.matchAll(/(?:export\s+)?(?:default\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)
  for (const match of functionMatches) {
    if (match[1]) {
      addCandidate(match[1])
    }
  }

  const classMatches = code.matchAll(/(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:extends|\{)/g)
  for (const match of classMatches) {
    if (match[1]) {
      addCandidate(match[1])
    }
  }

  const variableMatches = code.matchAll(
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)\s*=>|function\s*\()/g,
  )
  for (const match of variableMatches) {
    if (match[1]) {
      addCandidate(match[1])
    }
  }

  const defaultExportIdentifierMatch = code.match(/export\s+default\s+([A-Za-z_][A-Za-z0-9_]*)\s*;?/)
  if (defaultExportIdentifierMatch?.[1]) {
    addCandidate(defaultExportIdentifierMatch[1])
  }

  return Array.from(candidates)
}

function shouldWrapCanvasSourceAsJsxComponent(code: string) {
  const trimmed = code.trim()
  if (!trimmed) {
    return false
  }

  if (
    /\b(function|class|const|let|var)\b/.test(trimmed) ||
    /\bexport\b/.test(trimmed) ||
    /\breturn\b/.test(trimmed)
  ) {
    return false
  }

  return /<[A-Za-z]/.test(trimmed)
}

function sanitizeCanvasReactSource(code: string) {
  return code
    .replace(/^\s*import\s+React\s*,\s*\{([^}]*)\}\s+from\s+['"]react['"];?\s*$/gm, 'const {$1} = React;')
    .replace(/^\s*import\s+\{([^}]*)\}\s+from\s+['"]react['"];?\s*$/gm, 'const {$1} = React;')
    .replace(/^\s*import\s+\*\s+as\s+React\s+from\s+['"]react['"];?\s*$/gm, '')
    .replace(/^\s*import\s+React\s+from\s+['"]react['"];?\s*$/gm, '')
    .replace(/^\s*import\s+.*from\s+['"]react-dom\/client['"];?\s*$/gm, '')
    .replace(/^\s*import\s+.*from\s+['"]react-dom['"];?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/gm, 'function $1')
    .replace(/^\s*export\s+default\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/gm, 'class $1')
    .replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ')
    .replace(/^\s*export\s+default\s+/gm, 'const __CanvasDefaultExport = ')
    .replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, '')
}

function renderExecutableCanvasReactCode(
  sourceCode: string,
  language: ExecutableCanvasLanguage,
  mountNode: HTMLElement,
) {
  const preparedSource = shouldWrapCanvasSourceAsJsxComponent(sourceCode)
    ? `const __CanvasDefaultExport = () => (<>${sourceCode}</>);`
    : sourceCode
  const componentCandidateNames = extractCanvasComponentCandidateNames(preparedSource)
  const componentCandidateChecks = componentCandidateNames
    .map((candidateName) => `typeof ${candidateName} !== 'undefined' ? ${candidateName} : null`)
    .join(',\n')
  const sanitizedSource = sanitizeCanvasReactSource(preparedSource)
  const compiled = BabelStandalone.transform(
    `
      const __canvas_result__ = (() => {
        ${sanitizedSource}
        const __candidateComponent = [
          typeof __CanvasDefaultExport !== 'undefined' ? __CanvasDefaultExport : null,
          ${componentCandidateChecks || 'null'},
          typeof App !== 'undefined' ? App : null,
          typeof TodoList !== 'undefined' ? TodoList : null,
          typeof Component !== 'undefined' ? Component : null,
        ].find((candidate) => typeof candidate === 'function' || (candidate && typeof candidate === 'object'));

        return {
          __CanvasComponent: __candidateComponent ?? null,
          __CanvasRender: typeof render === 'function' ? render : null,
        };
      })();
      __canvas_result__;
    `,
    {
      filename: getBabelFilenameForCanvas(language),
      presets: ['react', 'typescript'],
    },
  ).code

  const evaluate = new Function(
    'React',
    `${compiled ?? ''}
return typeof __canvas_result__ !== 'undefined' ? __canvas_result__ : undefined;`,
  )
  const result = evaluate(ReactRuntime) as {
    __CanvasComponent?: unknown
    __CanvasRender?: unknown
  }

  let root: Root | null = null
  let didScheduleUnmount = false
  if (result?.__CanvasComponent) {
    root = createRoot(mountNode)
    root.render(ReactRuntime.createElement(result.__CanvasComponent as ReactRuntime.ComponentType))
  } else if (typeof result?.__CanvasRender === 'function') {
    ;(result.__CanvasRender as (node: HTMLElement) => void)(mountNode)
  } else {
    mountNode.textContent = 'No renderable React component found. Define App, TodoList, Component, or render().'
  }

  return () => {
    if (!root || didScheduleUnmount) {
      return
    }

    didScheduleUnmount = true
    const unmountRoot = () => {
      root?.unmount()
      root = null
    }

    if (typeof queueMicrotask === 'function') {
      queueMicrotask(unmountRoot)
      return
    }

    window.setTimeout(unmountRoot, 0)
  }
}

function buildExecutablePreviewDocument(code: string, language: ShikiLanguage) {
  const trimmedCode = code.trim()

  if (!trimmedCode) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Canvas Preview</title>
</head>
<body>
  <main style="padding: 16px; font-family: Inter, Arial, sans-serif;">No preview content available.</main>
</body>
</html>`
  }

  if (language === 'html' || /<!doctype html|<html[\s>]/i.test(trimmedCode)) {
    return trimmedCode
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Canvas Preview</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; background: #ffffff; color: #0f172a; }
    pre { overflow: auto; border-radius: 12px; background: #0f172a; color: #e2e8f0; padding: 16px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <pre>${escapePreviewHtml(trimmedCode)}</pre>
</body>
</html>`
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
  const reactPreviewHostRef = useRef<HTMLDivElement | null>(null)
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
  const activeVersionLanguage = inferShikiLanguage(activeVersion.code)
  const legacyEmbeddedSource = useMemo(() => getEmbeddedLegacyCanvasSource(activeVersion.code), [activeVersion.code])
  const executableSourceLanguage: ExecutableCanvasLanguage | null = useMemo(() => {
    if (legacyEmbeddedSource) {
      return legacyEmbeddedSource.language
    }

    if (
      activeVersionLanguage === 'js' ||
      activeVersionLanguage === 'ts' ||
      activeVersionLanguage === 'tsx'
    ) {
      return activeVersionLanguage
    }

    return null
  }, [activeVersionLanguage, legacyEmbeddedSource])
  const executableSourceCode = legacyEmbeddedSource?.code ?? activeVersion.code
  const shouldUseReactRuntimePreview = executableSourceLanguage !== null
  const shouldUseIframePreview = useMemo(() => {
    if (shouldUseReactRuntimePreview) {
      return false
    }

    return /<script[\s>]/i.test(activeVersion.code)
  }, [activeVersion.code, shouldUseReactRuntimePreview])
  const iframePreviewDocument = useMemo(
    () => (shouldUseIframePreview ? buildExecutablePreviewDocument(activeVersion.code, activeVersionLanguage) : ''),
    [activeVersion.code, activeVersionLanguage, shouldUseIframePreview],
  )

  useEffect(() => {
    if (shouldUseIframePreview) {
      return
    }

    if (shouldUseReactRuntimePreview && executableSourceLanguage) {
      const host = reactPreviewHostRef.current
      if (!host) {
        return
      }
      host.style.height = '100%'

      const shell = document.createElement('div')
      shell.style.height = '100%'
      shell.style.width = '100%'
      shell.style.display = 'flex'
      shell.innerHTML = `
        <style>
          *, *::before, *::after {
            box-sizing: border-box;
          }

          .lovechat-preview-root {
            min-height: 100%;
            height: 100%;
            width: 100%;
            color: #111827;
            background: #ffffff;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
            padding: 24px;
            display: flex;
            flex-direction: column;
          }

          @media (prefers-color-scheme: dark) {
            .lovechat-preview-root {
              color: #e5e7eb;
              background: #0a0f1c;
            }
          }

          .lovechat-react-mount {
            min-height: 100%;
            width: 100%;
            height: 100%;
            flex: 1;
            display: flex;
            flex-direction: column;
          }

          .lovechat-react-mount > * {
            width: 100% !important;
            max-width: none !important;
            min-height: 100% !important;
            height: 100% !important;
            flex: 1 1 auto;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }

          .lovechat-react-mount > * > * {
            min-height: 100%;
          }

          .lovechat-preview-error {
            margin: 0;
            white-space: pre-wrap;
            color: #991b1b;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 12px;
            padding: 12px;
          }
        </style>
        <div class="lovechat-preview-root">
          <div class="lovechat-react-mount"></div>
        </div>
      `

      host.replaceChildren(shell)
      const mountNode = host.querySelector('.lovechat-react-mount')
      if (!(mountNode instanceof HTMLElement)) {
        return
      }

      let dispose: (() => void) | undefined
      try {
        dispose = renderExecutableCanvasReactCode(
          executableSourceCode,
          executableSourceLanguage,
          mountNode,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        mountNode.innerHTML = `<pre class="lovechat-preview-error">Unable to render preview:\n${escapePreviewHtml(message)}</pre>`
      }

      return () => {
        dispose?.()
        host.replaceChildren()
      }
    }

    const host = previewHostRef.current
    if (!host) {
      return
    }

    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    const shell = document.createElement('div')
      shell.style.height = '100%'
      shell.style.width = '100%'
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
  }, [
    executableSourceCode,
    executableSourceLanguage,
    previewData.bodyClass,
    previewData.bodyHtml,
    previewData.styles,
    previewData.stylesheetLinks,
    shouldUseIframePreview,
    shouldUseReactRuntimePreview,
  ])

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
        {shouldUseIframePreview ? (
          <iframe
            title="Canvas preview"
            srcDoc={iframePreviewDocument}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            className="h-full min-h-full w-full border-0 bg-white"
          />
        ) : shouldUseReactRuntimePreview ? (
          <div className="absolute inset-0 overflow-y-auto">
            <div ref={reactPreviewHostRef} className="h-full min-h-full w-full" />
          </div>
        ) : (
          <div ref={previewHostRef} className="min-h-full w-full" />
        )}

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
