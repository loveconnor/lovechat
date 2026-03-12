# @loveui/code-blocks

React code-block components for LoveUI.

## Install

```bash
pnpm add @loveui/code-blocks
```

## Required Styles

Import your project styles and at least one highlighter stylesheet.

```css
@import "@loveui/code-blocks/styles/globals.css";
@import "@loveui/code-blocks/styles/shiki.css";
/* or */
@import "@loveui/code-blocks/styles/sugar-high.css";
```

## Usage

```tsx
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockContent,
  CodeBlockGroup,
  CodeBlockIcon,
  CopyButton,
  CodeblockShiki,
} from "@loveui/code-blocks";

const code = "console.log('LoveUI');";

export function Example() {
  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockGroup>
          <CodeBlockIcon language="ts" />
          <span>example.ts</span>
        </CodeBlockGroup>
        <CopyButton content={code} />
      </CodeBlockHeader>
      <CodeBlockContent>
        <CodeblockShiki code={code} language="ts" />
      </CodeBlockContent>
    </CodeBlock>
  );
}
```

## Exports

- Code block primitives: `CodeBlock`, `CodeBlockHeader`, `CodeBlockContent`, `CodeBlockGroup`, `CodeBlockIcon`
- Highlighters: `CodeblockShiki`, `CodeBlockSugarHigh`
- MDX helpers: `PreShikiComponent`, `PreSugarHighComponent`
- Blocks: `InlineCode`, `MultiTabs`, `CodeBlockSelectPkg`, `CodeBlockTabsPkg`
- Utilities: `cn`, `copyToClipboard`, `reactToText`, `highlight`, `sugarHighHighlight`
- Store: `usePackageManager`
