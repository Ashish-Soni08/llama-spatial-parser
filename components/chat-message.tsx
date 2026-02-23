"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Bot, User, Copy, Check, FileText } from "lucide-react"

function getMessageText(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return ""
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

interface ChatMessageProps {
  message: UIMessage
  isStreaming?: boolean
  onNavigateToPage?: (page: number) => void
}

export function ChatMessage({
  message,
  isStreaming,
  onNavigateToPage,
}: ChatMessageProps) {
  const isUser = message.role === "user"
  const text = getMessageText(message)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }, [text])

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground"
        )}
        aria-hidden="true"
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span className="text-xs text-muted-foreground">
            {isUser ? "You" : "Llama Assistant"}
          </span>

          {/* Copy button -- only for assistant messages, visible on hover */}
          {!isUser && !isStreaming && text && (
            <button
              onClick={handleCopy}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              aria-label={copied ? "Copied" : "Copy message"}
            >
              {copied ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm border border-border bg-card text-card-foreground"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{text}</p>
          ) : (
            <div className="prose-chat">
              {message.parts?.map((part, index) => {
                if (part.type === "text") {
                  return (
                    <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
                      {part.text}
                    </ReactMarkdown>
                  )
                }

                // Render navigateToPage tool calls as clickable page reference chips
                if (
                  part.type === "tool-invocation" &&
                  part.toolInvocation.toolName === "navigateToPage"
                ) {
                  const { pageNumber, reason } = (part.toolInvocation.input ?? {}) as {
                    pageNumber?: number
                    reason?: string
                  }
                  if (!pageNumber) return null
                  return (
                    <button
                      key={index}
                      onClick={() => onNavigateToPage?.(pageNumber)}
                      className="my-1 mr-1 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/10"
                      aria-label={`Go to page ${pageNumber}: ${reason || ""}`}
                    >
                      <FileText className="h-3 w-3" />
                      <span>Page {pageNumber}</span>
                      {reason && (
                        <>
                          <span className="text-primary/40">|</span>
                          <span className="text-primary/80">{reason}</span>
                        </>
                      )}
                    </button>
                  )
                }

                // Skip other tool-invocation parts (e.g. pending state)
                if (part.type === "tool-invocation") return null

                return null
              })}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
