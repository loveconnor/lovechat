"use client";

import type { Languages } from "../../../utils/shiki/highlight";

import {
  CodeBlock,
  CodeBlockContent,
} from "../code-block";
import { CopyButton } from "../copy-button";
import { CodeblockShiki } from "../client/shiki";

interface InlineCodeProps {
  code: string;
  language?: Languages;
}

const InlineCode = ({ code, language = "bash" }: InlineCodeProps) => {
  return (
    <CodeBlock>
      <CodeBlockContent className="flex w-full items-center justify-between">
        <CodeblockShiki language={language} code={code} />
        <CopyButton className="px-3" content={code} />
      </CodeBlockContent>
    </CodeBlock>
  );
};

export default InlineCode;
