const INLINE_CODE_BASE_CLASSNAME =
  "rounded-md bg-muted px-[0.3em] py-[0.2em] font-mono text-sm";

// Matches editor mark behavior where preserving whitespace is useful.
export const EDITOR_INLINE_CODE_CLASSNAME = `${INLINE_CODE_BASE_CLASSNAME} whitespace-pre-wrap`;

// Markdown inline code should not preserve raw spacing/newlines from generated text.
export const MARKDOWN_INLINE_CODE_CLASSNAME = `${INLINE_CODE_BASE_CLASSNAME} whitespace-normal align-middle`;