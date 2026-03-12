"use client";

import {
  useEffect,
  useRef,
  useState
  
} from "react";
import type {ComponentProps} from "react";

import { cn } from "../../../utils/cn";
import { highlight, Themes  } from "../../../utils/shiki/highlight";
import type {Languages} from "../../../utils/shiki/highlight";

interface CodeblockClientShikiProps extends ComponentProps<"div"> {
  code: string;
  language?: Languages;
  lineNumbers?: boolean;
}

const CodeblockShiki = ({
  code,
  language = "tsx",
  lineNumbers = false,
  className,
  ...props
}: CodeblockClientShikiProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const resolveThemeMode = () => {
      const isDark =
        !!containerRef.current?.closest(".dark") ||
        document.documentElement.classList.contains("dark") ||
        document.body.classList.contains("dark");

      setThemeMode(isDark ? "dark" : "light");
    };

    resolveThemeMode();

    const observer = new MutationObserver(resolveThemeMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function clientHighlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>");
        return;
      }
      const highlighter = await highlight();
      const html = highlighter.codeToHtml(code, {
        lang: language,
        theme: themeMode === "dark" ? Themes.dark : Themes.light,
        transformers: [
          {
            name: "AddLineNumbers",
            pre(node) {
              const currentStyle =
                typeof node.properties.style === "string"
                  ? node.properties.style
                  : "";
              const styleWithoutBackground = currentStyle
                .split(";")
                .map((part) => part.trim())
                .filter((part) => part && !part.startsWith("background-color:"))
                .join("; ");

              const preSpacing = "padding-top: 0.5rem; padding-bottom: 0.5rem;";
              node.properties.style = styleWithoutBackground
                ? `${styleWithoutBackground}; ${preSpacing}`
                : preSpacing;

              if (lineNumbers) {
                const currentClass = node.properties.class;
                const classNames = Array.isArray(currentClass)
                  ? currentClass.map(String)
                  : typeof currentClass === "string"
                    ? currentClass.split(/\s+/).filter(Boolean)
                    : [];

                if (!classNames.includes("shiki-line-numbers")) {
                  classNames.push("shiki-line-numbers");
                }

                node.properties.class = classNames;
              }
            },
            line(node) {
              const currentStyle =
                typeof node.properties.style === "string"
                  ? node.properties.style
                  : "";
              const normalizedStyle = currentStyle.endsWith(";")
                ? currentStyle
                : currentStyle
                  ? `${currentStyle};`
                  : "";

              node.properties.style = `${normalizedStyle} display: inline-block; width: 100%; box-sizing: border-box; padding-left: 1rem; padding-right: 1rem;`;
            },
          },
        ],
      });
      setHighlightedHtml(html);
    }
    void clientHighlight();
  }, [code, language, lineNumbers, themeMode]);

  const classNames = cn("w-full overflow-x-auto", className);

  // SSR fallback
  return highlightedHtml ? (
    <div
      ref={containerRef}
      className={classNames}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props}
    />
  ) : (
    <div ref={containerRef} className={classNames} {...props}>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
};

export { CodeblockShiki };
