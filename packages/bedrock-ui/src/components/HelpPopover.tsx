/**
 * @file HelpPopover.tsx
 * @module @djntechnic/bedrock-ui/components
 * @description Config-driven in-app quick help popover (Bedrock #69 / MLBTracker #401).
 * Composes Radix Popover primitives, markdown/text rendering, and external documentation link.
 */
import { ExternalLink, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";
import { useHelpConfig } from "../hooks/useHelpConfig";
import { cn } from "../lib/utils";

export interface HelpPopoverProps {
  topic: string;
  variant?: "icon" | "button" | "subtle";
  align?: "center" | "start" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  triggerClassName?: string;
}

/**
 * Basic markdown parser for bold, italics, code, and paragraphs.
 * Keeps bundle footprint zero by avoiding heavy external markdown parser deps.
 */
function SimpleMarkdown({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/);

  return (
    <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
      {paragraphs.map((p, idx) => {
        // Format inline tokens: **bold**, *italic*, `code`
        const parts = p.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

        return (
          <p key={idx}>
            {parts.map((part, partIdx) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong key={partIdx} className="font-semibold text-foreground">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (part.startsWith("*") && part.endsWith("*")) {
                return <em key={partIdx}>{part.slice(1, -1)}</em>;
              }
              if (part.startsWith("`") && part.endsWith("`")) {
                return (
                  <code
                    key={partIdx}
                    className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground"
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

export default function HelpPopover({
  topic,
  variant: _variant = "icon",
  align = "end",
  side = "bottom",
  className,
  triggerClassName,
}: HelpPopoverProps) {
  const { helpEntry, isLoading, isError } = useHelpConfig(topic);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 p-0 text-muted-foreground hover:text-foreground",
            triggerClassName,
          )}
          aria-label={`Help: ${topic}`}
          title={`Help: ${topic}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className={cn("w-80 p-3.5 shadow-lg", className)}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading help topic...
          </div>
        ) : isError || !helpEntry ? (
          <div className="py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Help topic unavailable</p>
            <p className="text-[11px]">No content is configured for topic <code className="font-mono text-foreground">{topic}</code>.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <PopoverHeader>
              <PopoverTitle className="text-xs font-semibold text-foreground tracking-tight">
                {helpEntry.title}
              </PopoverTitle>
            </PopoverHeader>

            <SimpleMarkdown content={helpEntry.body_markdown} />

            {helpEntry.doc_url && (
              <div className="pt-1 mt-1 border-t border-border/50 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 text-xs gap-1.5 text-primary hover:text-primary"
                >
                  <a
                    href={helpEntry.doc_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{helpEntry.doc_label || "Documentation"}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
