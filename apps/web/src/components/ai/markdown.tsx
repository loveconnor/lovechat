import { cn } from "@/lib/utils";
import React, { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { LayoutTemplate } from "lucide-react";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockIcon,
  CodeBlockGroup,
  CodeBlockContent,
  CopyButton,
  CodeblockShiki,
} from "@/components/ui/code-block";
import type { Languages as ShikiLanguage } from "@/components/ui/code-block";
import { MARKDOWN_INLINE_CODE_CLASSNAME } from "#/components/ui/inline-code-style";

export type MarkdownProps = {
  children: string;
  className?: string;
  components?: Partial<Components>;
  onConvertToCanvas?: (payload: { code: string; language: string }) => void;
};

type CodeLanguage =
  | "html"
  | "js"
  | "ts"
  | "tsx"
  | "css"
  | "bash"
  | "json"
  | "mdx"
  | "python"
  | "java"
  | "cpp"
  | "go";

const LANGUAGE_ALIASES: Record<string, CodeLanguage> = {
  bash: "bash",
  c: "cpp",
  cxx: "cpp",
  cpp: "cpp",
  "c++": "cpp",
  css: "css",
  golang: "go",
  go: "go",
  html: "html",
  javascript: "js",
  js: "js",
  json: "json",
  jsx: "js",
  md: "mdx",
  markdown: "mdx",
  mdx: "mdx",
  py: "python",
  python: "python",
  shell: "bash",
  sh: "bash",
  ts: "ts",
  tsx: "tsx",
  typescript: "ts",
  xml: "html",
  zsh: "bash",
};

const SHIKI_LANGUAGE_MAP: Record<CodeLanguage, ShikiLanguage> = {
  html: "html",
  js: "js",
  ts: "ts",
  tsx: "tsx",
  css: "css",
  bash: "bash",
  json: "json",
  mdx: "mdx",
  // Fallbacks for languages not currently registered in the local Shiki setup.
  python: "ts",
  java: "ts",
  cpp: "ts",
  go: "ts",
};

const EM_DASH_PATTERN = /\s*—\s*/g;
const MATH_SPECIAL_SEGMENT_PATTERN = /(```[\s\S]*?```|`[^`]+`|\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;

const UNICODE_LATEX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Δ/g, "\\Delta"],
  [/θ/g, "\\theta"],
  [/ω/g, "\\omega"],
  [/α/g, "\\alpha"],
  [/β/g, "\\beta"],
  [/γ/g, "\\gamma"],
  [/δ/g, "\\delta"],
  [/λ/g, "\\lambda"],
  [/μ/g, "\\mu"],
  [/π/g, "\\pi"],
  [/φ/g, "\\phi"],
  [/τ/g, "\\tau"],
  [/≤/g, "\\le"],
  [/≥/g, "\\ge"],
  [/≠/g, "\\ne"],
  [/≈/g, "\\approx"],
  [/↔/g, "\\leftrightarrow"],
  [/×/g, "\\times"],
  [/·/g, "\\cdot"],
  [/²/g, "^2"],
  [/³/g, "^3"],
  [/½/g, "\\frac{1}{2}"],
];

function normalizeEmDashes(text: string): string {
  return text.replace(EM_DASH_PATTERN, ", ");
}

function toInlineLatex(mathText: string): string {
  let normalized = mathText.trim();

  normalized = normalized
    .replace(/Δθ/g, "\\Delta \\theta")
    .replace(/Δω/g, "\\Delta \\omega")
    .replace(/Δα/g, "\\Delta \\alpha")
    .replace(/Δt/g, "\\Delta t")
    .replace(/θi/g, "\\theta_i")
    .replace(/θf/g, "\\theta_f")
    .replace(/ωi/g, "\\omega_i")
    .replace(/ωf/g, "\\omega_f")
    .replace(/αi/g, "\\alpha_i")
    .replace(/αf/g, "\\alpha_f")
    .replace(/ωavg/g, "\\omega_{avg}")
    .replace(/αavg/g, "\\alpha_{avg}")
    .replace(/θavg/g, "\\theta_{avg}")
    .replace(/dθ\s*\/\s*dt/g, "\\frac{d\\theta}{dt}")
    .replace(/dω\s*\/\s*dt/g, "\\frac{d\\omega}{dt}")
    .replace(/dα\s*\/\s*dt/g, "\\frac{d\\alpha}{dt}")
    .replace(/Δθ\s*\/\s*Δt/g, "\\frac{\\Delta \\theta}{\\Delta t}")
    .replace(/Δω\s*\/\s*Δt/g, "\\frac{\\Delta \\omega}{\\Delta t}")
    .replace(/Δα\s*\/\s*Δt/g, "\\frac{\\Delta \\alpha}{\\Delta t}");

  for (const [pattern, replacement] of UNICODE_LATEX_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/\\theta\s*([if0-9]+)/g, "\\theta_$1")
    .replace(/\\omega\s*([if0-9]+)/g, "\\omega_$1")
    .replace(/\\alpha\s*([if0-9]+)/g, "\\alpha_$1")
    .replace(/\\Delta\s*([if0-9]+)/g, "\\Delta_$1")
    .replace(/\\Delta(?=[A-Za-z])/g, "\\Delta ")
    .replace(/\\theta(?=[A-Za-z])/g, "\\theta ")
    .replace(/\\omega(?=[A-Za-z])/g, "\\omega ")
    .replace(/\\alpha(?=[A-Za-z])/g, "\\alpha ")
    .replace(/\b([a-zA-Z])([if])\b/g, "$1_$2")
    .replace(/\s+/g, " ")
    .trim();

  return `$${normalized}$`;
}

function isProtectedMarkdownSegment(segment: string): boolean {
  return /^(?:```[\s\S]*```|`[^`]+`|\$\$[\s\S]*\$\$|\$[^$\n]+\$)$/.test(segment);
}

function normalizeBareUnicodeMath(markdown: string): string {
  const segments = markdown.split(MATH_SPECIAL_SEGMENT_PATTERN);

  return segments
    .map((segment) => {
      if (!segment || isProtectedMarkdownSegment(segment)) {
        return segment;
      }

      let nextSegment = segment;

      nextSegment = nextSegment.replace(
        /((?:Δ?[A-Za-z]|[Δθωαβγδλμφτ])(?:\s*[if0-9])?\s*=\s*(?:[ΔθωαβγδλμφτA-Za-z0-9_+\-*/^=]|²|³|½|\s|\.|\(|\))+?)(?=(?:\s+\(|\s+(?:where|with|for|because|since|when)\b|[.,;:]|$))/g,
        (_match, expression) => toInlineLatex(expression),
      );

      nextSegment = nextSegment.replace(
        /(^|[\s(])([Δθωαβγδλμφτ])(?=($|[\s),.;:]))/g,
        (_match, prefix, symbol) => `${prefix}${toInlineLatex(symbol)}`,
      );

      return nextSegment;
    })
    .join("");
}

function normalizeCodeLanguage(language?: string | null): CodeLanguage {
  if (!language) return "java";
  return LANGUAGE_ALIASES[language.toLowerCase()] ?? "java";
}

function toShikiLanguage(language: CodeLanguage): ShikiLanguage {
  return SHIKI_LANGUAGE_MAP[language];
}

function inferCodeLanguage(rawLanguage: string | null, code: string): CodeLanguage {
  let language = normalizeCodeLanguage(rawLanguage);
  if (rawLanguage) return language;

  const codeStr = code.toLowerCase();
  if (codeStr.includes("def ") || (codeStr.includes("import ") && codeStr.includes("from "))) {
    language = normalizeCodeLanguage("python");
  } else if (
    codeStr.includes("function ") ||
    codeStr.includes("const ") ||
    codeStr.includes("let ") ||
    codeStr.includes("=>")
  ) {
    language = normalizeCodeLanguage("javascript");
  } else if (
    codeStr.includes("class ") &&
    (codeStr.includes("public ") || codeStr.includes("private ") || codeStr.includes("static "))
  ) {
    language = normalizeCodeLanguage("java");
  } else if (codeStr.includes("#include") || codeStr.includes("std::")) {
    language = normalizeCodeLanguage("cpp");
  } else if (codeStr.includes("package ") || codeStr.includes("func ")) {
    language = normalizeCodeLanguage("go");
  }

  return language;
}

function extractLeadingLanguageLine(code: string): { language: CodeLanguage; code: string } | null {
  const lines = code.split("\n");
  if (lines.length < 2) return null;

  const first = lines[0].trim().toLowerCase();
  if (!first) return null;

  const firstToken = first.replace(/[:;,-]+$/, "");
  if (!(firstToken in LANGUAGE_ALIASES)) return null;

  const rest = lines.slice(1).join("\n").replace(/^\n+/, "");
  if (!rest.trim()) return null;

  const looksLikeCode = /[{}();=<>]|^\s*(for|if|while|class|function|const|let|var|public|private|import|def)\b/m.test(rest);
  if (!looksLikeCode) return null;

  return {
    language: normalizeCodeLanguage(firstToken),
    code: rest,
  };
}

function shouldPromoteInlineCodeToBlock(code: string, inTableCell: boolean): boolean {
  if (!inTableCell) return false;

  const trimmed = code.trim();
  if (!trimmed) return false;

  const tokenCount = trimmed.split(/\s+/).length;
  const hasCodeSyntax = /[{};]|=>|::|->/.test(trimmed);
  const hasKeyword =
    /\b(for|while|if|switch|class|function|const|let|var|return|public|private)\b/.test(trimmed);

  return tokenCount >= 5 && (hasCodeSyntax || hasKeyword);
}

function extractOptionalFilename({
  className,
  node,
}: {
  className?: string;
  node: unknown;
}) {
  const n = node as any;
  const candidates = [
    typeof n?.data?.meta === "string" ? n.data.meta : "",
    typeof n?.meta === "string" ? n.meta : "",
    typeof n?.properties?.meta === "string" ? n.properties.meta : "",
    typeof n?.properties?.metastring === "string" ? n.properties.metastring : "",
    className ?? "",
  ];

  for (const value of candidates) {
    if (!value) continue;
    const match = value.match(
      /(?:^|\s)(?:filename|file|title)=("([^"]+)"|'([^']+)'|([^\s]+))/i
    );
    if (match) return (match[2] || match[3] || match[4] || "").trim();
  }

  return undefined;
}

const MarkdownRenderContext = React.createContext<{ inTableCell: boolean }>({ inTableCell: false });
const MarkdownCanvasActionContext = React.createContext<MarkdownProps["onConvertToCanvas"] | undefined>(undefined);

type MarkdownCodeRendererProps = {
  className?: string;
  children?: React.ReactNode;
  node?: unknown;
  inTableCell: boolean;
  onConvertToCanvas?: MarkdownProps["onConvertToCanvas"];
};

function renderMarkdownCode({
  className,
  children,
  node,
  inTableCell,
  onConvertToCanvas,
}: MarkdownCodeRendererProps) {
  const match = /language-([A-Za-z0-9_+-]+)/.exec(className || '');
  const isInline = !match && !String(children).includes('\n');

  if (isInline) {
    const content = String(children);
    const isMath = content.startsWith('$') && content.endsWith('$') && content.length > 2;

    if (isMath) {
      const mathContent = content.slice(1, -1);
      return (
        <code
          className={cn(MARKDOWN_INLINE_CODE_CLASSNAME, className)}
        >
          {mathContent}
        </code>
      );
    }

    if (shouldPromoteInlineCodeToBlock(content, inTableCell)) {
      const inlineCode = content.trim();
      const language = inferCodeLanguage(null, inlineCode);
      const shikiLanguage = toShikiLanguage(language);
      return (
        <CodeBlock className="border-border/70 my-1 shadow-none dark:border-white/15">
          <CodeBlockHeader className="border-b border-border/60 dark:border-white/10">
            <CodeBlockGroup>
              <CodeBlockIcon language={language} className="size-5" />
            </CodeBlockGroup>
            <div className="flex items-center gap-2">
              {onConvertToCanvas ? (
                <button
                  type="button"
                  onClick={() => onConvertToCanvas({ code: inlineCode, language })}
                  className="inline-flex items-center gap-1 text-neutral-600 transition-colors duration-200 ease-in-out hover:text-neutral-950 dark:text-neutral-400 hover:dark:text-neutral-50"
                  aria-label="Convert code to canvas"
                  title="Convert to canvas"
                >
                  <LayoutTemplate size={14} />
                  <span className="text-xs font-medium">Canvas</span>
                </button>
              ) : null}
              <CopyButton content={inlineCode} />
            </div>
          </CodeBlockHeader>
          <CodeBlockContent className="whitespace-normal rounded-none rounded-b-lg bg-muted/50 dark:bg-black/25">
            <CodeblockShiki code={inlineCode} language={shikiLanguage} className="[&>pre]:m-0" />
          </CodeBlockContent>
        </CodeBlock>
      );
    }

    return (
      <code
        className={cn(MARKDOWN_INLINE_CODE_CLASSNAME, className)}
      >
        {children}
      </code>
    );
  }

  const rawLanguage = match ? match[1] : null;
  let code = String(children ?? "").replace(/^\n+/, "").replace(/\n$/, "");
  let language = inferCodeLanguage(rawLanguage, code);
  if (!rawLanguage) {
    const extracted = extractLeadingLanguageLine(code);
    if (extracted) {
      code = extracted.code;
      language = extracted.language;
    }
  }
  const shikiLanguage = toShikiLanguage(language);
  const optionalFilename = extractOptionalFilename({ className, node });

  return (
    <CodeBlock className="border-border/70 shadow-none dark:border-white/15">
      <CodeBlockHeader className="border-b border-border/60 dark:border-white/10">
        <CodeBlockGroup>
          <CodeBlockIcon language={language} className="size-5" />
          {optionalFilename ? <span>{optionalFilename}</span> : null}
        </CodeBlockGroup>
        <div className="flex items-center gap-2">
          {onConvertToCanvas ? (
            <button
              type="button"
              onClick={() => onConvertToCanvas({ code, language })}
              className="inline-flex items-center gap-1 text-neutral-600 transition-colors duration-200 ease-in-out hover:text-neutral-950 dark:text-neutral-400 hover:dark:text-neutral-50"
              aria-label="Convert code to canvas"
              title="Convert to canvas"
            >
              <LayoutTemplate size={14} />
              <span className="text-xs font-medium">Canvas</span>
            </button>
          ) : null}
          <CopyButton content={code} />
        </div>
      </CodeBlockHeader>
      <CodeBlockContent className="whitespace-normal rounded-none rounded-b-lg bg-muted/50 dark:bg-black/25">
        <CodeblockShiki code={code} language={shikiLanguage} className="[&>pre]:m-0" />
      </CodeBlockContent>
    </CodeBlock>
  );
}

function inferImageExtensionFromUrl(url: string): string {
  if (url.startsWith("data:image/")) {
    const mimeMatch = url.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/i);
    const raw = mimeMatch?.[1]?.toLowerCase() ?? "png";
    return raw === "jpeg" ? "jpg" : raw;
  }

  const path = url.split("?")[0] ?? "";
  const extMatch = path.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch?.[1]?.toLowerCase();
  if (!ext) {
    return "png";
  }

  return ext === "jpeg" ? "jpg" : ext;
}

function triggerBrowserDownload(href: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function downloadImage(url: string) {
  const extension = inferImageExtensionFromUrl(url);
  const fileName = `lovechat-image-${Date.now()}.${extension}`;

  if (url.startsWith("data:image/")) {
    triggerBrowserDownload(url, fileName);
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Unable to fetch image for download");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerBrowserDownload(objectUrl, fileName);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const DEFAULT_COMPONENTS: Partial<Components> = {
  h1: ({ children }) => <h1 className="mt-7 mb-4 text-3xl leading-tight font-semibold tracking-tight text-foreground first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-6 mb-3 text-2xl leading-tight font-semibold tracking-tight text-foreground first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-5 mb-2.5 text-xl leading-snug font-semibold text-foreground first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-4 mb-2 text-lg leading-snug font-semibold text-foreground first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-4 mb-2 text-base leading-snug font-semibold text-foreground first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="mt-4 mb-2 text-sm leading-snug font-semibold uppercase tracking-[0.08em] text-muted-foreground first:mt-0">{children}</h6>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-3 list-disc list-outside space-y-1 ps-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal list-outside space-y-1 ps-6">{children}</ol>,
  li: ({ children }) => (
    <li className="leading-7 marker:text-muted-foreground [&>h1]:mt-0 [&>h2]:mt-0 [&>h3]:mt-0 [&>h4]:mt-0 [&>h5]:mt-0 [&>h6]:mt-0 [&>p]:my-0 [&>p:empty]:hidden">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-muted-foreground/20 pl-4 italic my-4">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => {
    if (!src) {
      return null;
    }

    const resolvedAlt = typeof alt === "string" && alt.trim() ? alt.trim() : "Generated image";

    return (
      <div className="group/img relative w-full max-w-lg overflow-hidden rounded-[20px] border border-[#E5E5E5] bg-gray-50 shadow-sm dark:border-gray-700 dark:bg-[#2f2f2f]">
        <img
          src={src}
          alt={resolvedAlt}
          className="aspect-video h-auto w-full object-cover transition-transform duration-700 group-hover/img:scale-105"
          loading="lazy"
        />

        <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity duration-200 group-hover/img:opacity-100">
          <button
            type="button"
            onClick={() => void downloadImage(src)}
            aria-label="Download image"
            title="Download"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-gray-800 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-black focus:outline-none dark:bg-black/60 dark:text-gray-200 dark:hover:bg-black/80 dark:hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Generate variations"
            title="Variations"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-gray-800 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-black focus:outline-none dark:bg-black/60 dark:text-gray-200 dark:hover:bg-black/80 dark:hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
      </div>
    );
  },
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border-collapse border border-border">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
  th: ({ children }) => (
    <th className="border border-border px-4 py-2 text-left font-semibold">
      <MarkdownRenderContext.Provider value={{ inTableCell: true }}>
        {children}
      </MarkdownRenderContext.Provider>
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-4 py-2">
      <MarkdownRenderContext.Provider value={{ inTableCell: true }}>
        {children}
      </MarkdownRenderContext.Provider>
    </td>
  ),
  p: ({ children }) => (
    <MarkdownRenderContext.Consumer>
      {({ inTableCell }) => {
        // Check if paragraph contains block-level elements
        const hasBlockChild = React.Children.toArray(children).some(
          (child) => {
            if (!React.isValidElement(child)) return false;
            
            // Check if it's a code element that's not inline (block code)
            if (child.type === 'code') {
              const className = (child.props as any).className || '';
              const childChildren = (child.props as any).children || '';
              const isInline = !className.includes('language-') && !String(childChildren).includes('\n');
              return !isInline;
            }
            
            // Check for common block-level component types
            const childType = child.type;
            if (typeof childType === 'function') {
              const displayName = (childType as any).displayName || childType.name || '';
              return displayName.includes('CodeBlock') || displayName.includes('Table');
            }
            // Check for HTML block elements
            return ['div', 'pre', 'table', 'blockquote', 'ul', 'ol', 'hr'].includes(String(childType));
          }
        );
        
        if (hasBlockChild) {
          return <div className={cn("my-2", inTableCell && "my-0")}>{children}</div>;
        }

        if (inTableCell) {
          return <div className="leading-7">{children}</div>;
        }

        return <p className="mb-2 leading-7">{children}</p>;
      }}
    </MarkdownRenderContext.Consumer>
  ),
  code: ({ className, children, node }) => (
    <MarkdownRenderContext.Consumer>
      {({ inTableCell }) => (
        <MarkdownCanvasActionContext.Consumer>
          {(onConvertToCanvas) => renderMarkdownCode({ className, children, node, inTableCell, onConvertToCanvas })}
        </MarkdownCanvasActionContext.Consumer>
      )}
    </MarkdownRenderContext.Consumer>
  ),
  pre: ({ children }) => <>{children}</>
};

function MarkdownComponent({ children, className, components, onConvertToCanvas }: MarkdownProps) {
  const mergedComponents = useMemo(
    () => ({
      ...DEFAULT_COMPONENTS,
      ...components
    }),
    [components]
  );

  const processedContent = useMemo(() => {
    const sourceText = children;
    const normalizedSourceText = normalizeEmDashes(sourceText);

    return normalizedSourceText
      .replace(/^''' ?(.*\s.*)$/gm, '```\n$1')
      .replace(/^'''/gm, '```')
      .replace(/'''$/gm, '```')
      .replace(/\n'''/g, '\n```')
      .replace(/\\cdotps/g, '\\cdot\\,\\mathrm{ps}')
      .replace(/\\cdotp/g, '\\cdot')
      .replace(/\\cdot([a-zA-Z])/g, '\\cdot\\,\\mathrm{$1}');
  }, [children]);

  // Pre-process content to convert code-like math expressions to code blocks
  // This prevents KaTeX from trying to parse programming operators like &&, ||
  // Only match clearly programming-specific operators, not mathematical ones
  const finalProcessedContent = useMemo(() => {
    // Preserve markdown image syntax exactly as-is. The math normalization below can
    // accidentally rewrite image payloads (especially data URLs), causing broken output.
    if (/!\[[^\]]*\]\((?:<(?:data:image\/|https?:\/\/)[^>]+>|(?:data:image\/|https?:\/\/)[^)]+)\)/i.test(processedContent)) {
      return processedContent;
    }

    let processed = normalizeBareUnicodeMath(processedContent);
    const isBareLatexTableCell = (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || trimmed.includes('$')) return false;
      if (trimmed.includes('`')) return false;

      const hasLatexCommand = /\\[a-zA-Z]+/.test(trimmed);
      const hasMathStructure = /[_^{}]/.test(trimmed);
      const hasWhitespace = /\s/.test(trimmed);

      if (!hasLatexCommand || !hasMathStructure) return false;
      // Keep this narrowly targeted to expression-like cells, not prose.
      return !hasWhitespace || /^\S+\s*[,;:]?$/.test(trimmed);
    };

    const wrapBareLatexInTableRows = (markdown: string) =>
      markdown.replace(/^\|.*\|$/gm, (row) => {
        const cells = row.split('|');
        if (cells.length < 3) return row;

        for (let index = 1; index < cells.length - 1; index += 1) {
          const cell = cells[index];
          const trimmed = cell.trim();

          if (!trimmed || /^:?-{3,}:?$/.test(trimmed)) continue;
          if (!isBareLatexTableCell(trimmed)) continue;

          const leadingWhitespace = cell.match(/^\s*/)?.[0] ?? '';
          const trailingWhitespace = cell.match(/\s*$/)?.[0] ?? '';
          cells[index] = `${leadingWhitespace}$${trimmed}$${trailingWhitespace}`;
        }

        return cells.join('|');
      });

    processed = wrapBareLatexInTableRows(processed);

    // Convert [ math ] style display math to $$ math $$
    // This handles cases where AI uses square brackets for display math
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, content) => {
      return `$$${content}$$`;
    });

    // Convert \( math \) style inline math to $ math $
    // Handle both double-escaped and single-escaped variants
    processed = processed
      .replace(/\\\\\(([\s\S]*?)\\\\\)/g, (_match, content) => `$${content}$`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_match, content) => `$${content}$`);

    // Do not auto-wrap plain parenthesized content as math. That can corrupt
    // valid LaTeX grouping, e.g. \left( ... \right) -> \left$ ... \right$.
    
    // Also handle the case where square brackets are used without backslashes
    // Match [ followed by math content and closing ]
    // Only match if it contains math-like content (variables, operators, etc.)
    processed = processed.replace(/\[\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\s*[=+\-*/^_{}()\\]+\s*[a-zA-Z0-9_(){}\\]+)+[^[\]]*?)\s*\]/g, (match, content) => {
      // Check if this looks like math (has variables and operators)
      if (/[a-zA-Z_][a-zA-Z0-9_]*\s*[=+\-*/]/.test(content)) {
        return `$$${content}$$`;
      }
      return match;
    });
    
    // Match inline math expressions that contain programming-specific operators
    // Only match &&, ||, and !== (not != which could be factorial followed by =)
    // Avoid matching =, <, >, ! as these are common in math (equality, inequalities, factorial)
    const codeOperatorsPattern = /\$([^$\n]*?(?:&&|\|\||!==)[^$\n]*?)\$/g;
    
    processed = processed.replace(codeOperatorsPattern, (_match, content) => {
      // Convert $code$ to `code` (backtick code block instead of math)
      return `\`$${content}$\``;
    });
    
    return processed;
  }, [processedContent]);

  return (
    <div className={cn("prose prose-neutral dark:prose-invert max-w-none break-words prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border prose-pre:overflow-x-auto prose-code:before:content-none prose-code:after:content-none prose-headings:text-foreground prose-strong:text-foreground", className)}>
      <MarkdownCanvasActionContext.Provider value={onConvertToCanvas}>
        <ReactMarkdown
          remarkPlugins={[
            remarkGfm, 
            [remarkMath, { singleDollarTextMath: true }]
          ]}
          rehypePlugins={[rehypeKatex]}
          components={mergedComponents}>
          {finalProcessedContent}
        </ReactMarkdown>
      </MarkdownCanvasActionContext.Provider>
    </div>
  );
}

const Markdown = memo(MarkdownComponent);
Markdown.displayName = "Markdown";

export { Markdown };
