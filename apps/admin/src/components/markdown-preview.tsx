import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders lesson markdown. Raw HTML is not rendered, so authored content can't inject scripts. */
export function MarkdownPreview({ source }: { source: string }) {
  return (
    <div className="prose-lesson">
      <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
    </div>
  );
}
