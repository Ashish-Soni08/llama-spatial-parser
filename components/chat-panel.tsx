"use client"

import { useRef, useEffect, useState, useCallback, memo } from "react"
import { useChat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai"
import type { ChatToolMessage } from "@/app/api/chat/route"
import { ChatMessage } from "@/components/chat-message"
import {
  ArrowUp,
  Paperclip,
  FileText,
  Loader2,
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExtractionData } from "@/app/page"

interface ChatPanelProps {
  extraction: ExtractionData | null
  isExtracting: boolean
  extractionError: string | null
  onFileUpload: (file: File) => void
  hasDocument: boolean
  onNavigateToPage: (page: number) => void
}

const SUGGESTED_PROMPTS = [
  "Summarize this paper in 3 key points",
  "What methodology did the authors use?",
  "What are the main findings?",
  "What are the limitations of this study?",
]

// Memoize completed messages to avoid re-rendering markdown on every stream tick
const MemoizedMessage = memo(
  function MemoizedMessage({
    message,
    isStreaming,
    onNavigateToPage,
  }: {
    message: UIMessage
    isStreaming: boolean
    onNavigateToPage: (page: number) => void
  }) {
    return (
      <ChatMessage
        message={message}
        isStreaming={isStreaming}
        onNavigateToPage={onNavigateToPage}
      />
    )
  },
  (prev, next) => {
    // Only re-render if the message id changed or streaming state changed
    if (prev.isStreaming !== next.isStreaming) return false
    if (prev.message.id !== next.message.id) return false
    // If streaming, always re-render (content is changing)
    if (next.isStreaming) return false
    // For completed messages, skip re-render
    return true
  }
)

function ExtractionSummary({ extraction }: { extraction: ExtractionData }) {
  return (
    <div className="mx-4 mb-2 rounded-lg border border-success/20 bg-success/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        <span className="text-xs font-medium text-success">
          Paper extracted successfully
        </span>
      </div>
      {extraction.title && (
        <p className="text-xs font-medium text-foreground text-pretty leading-relaxed">
          {extraction.title}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {extraction.authors?.length ? (
          <span>
            {extraction.authors.length} author
            {extraction.authors.length > 1 ? "s" : ""}
          </span>
        ) : null}
        {extraction.sections?.length ? (
          <span>
            {extraction.sections.length} section
            {extraction.sections.length > 1 ? "s" : ""}
          </span>
        ) : null}
        {extraction.figures?.length ? (
          <span>
            {extraction.figures.length} figure
            {extraction.figures.length > 1 ? "s" : ""}
          </span>
        ) : null}
        {extraction.tables?.length ? (
          <span>
            {extraction.tables.length} table
            {extraction.tables.length > 1 ? "s" : ""}
          </span>
        ) : null}
        {extraction.key_findings?.length ? (
          <span>
            {extraction.key_findings.length} key finding
            {extraction.key_findings.length > 1 ? "s" : ""}
          </span>
        ) : null}
        {extraction.references_count != null ? (
          <span>{extraction.references_count} references</span>
        ) : null}
      </div>
    </div>
  )
}

export function ChatPanel({
  extraction,
  isExtracting,
  extractionError,
  onFileUpload,
  hasDocument,
  onNavigateToPage,
}: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isAutoScrolling = useRef(true)

  const extractionRef = useRef(extraction)
  extractionRef.current = extraction

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            messages,
            extraction: extractionRef.current,
          },
        }),
      })
  )

  const onNavigateRef = useRef(onNavigateToPage)
  onNavigateRef.current = onNavigateToPage

  const { messages, sendMessage, addToolOutput, status } =
    useChat<ChatToolMessage>({
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

      onToolCall({ toolCall }) {
        if (toolCall.dynamic) return

        if (toolCall.toolName === "navigateToPage") {
          const { pageNumber } = toolCall.input
          onNavigateRef.current(pageNumber)
          addToolOutput({
            tool: "navigateToPage",
            toolCallId: toolCall.toolCallId,
            output: `Navigated to page ${pageNumber}`,
          })
        }
      },
    })

  const isLoading = status === "streaming" || status === "submitted"

  // Smart auto-scroll: scroll to bottom during streaming only if user is near the bottom
  useEffect(() => {
    const el = scrollAreaRef.current
    if (!el) return
    if (isAutoScrolling.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [messages])

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const threshold = 100
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight
    isAutoScrolling.current = distanceFromBottom < threshold
  }, [])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

  function handleSubmit(text: string) {
    if (!text.trim() || isLoading) return
    isAutoScrolling.current = true
    sendMessage({ text: text.trim() })
    setInput("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== "application/pdf") return
    setPendingFile(file)
    onFileUpload(file)
    e.target.value = ""
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(input)
    }
  }

  const showEmptyState = messages.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground">
            Llama Spatial Parser
          </h1>
          <p className="text-xs text-muted-foreground">
            AI Research Paper Assistant
          </p>
        </div>

        {/* Extraction status */}
        {isExtracting && (
          <div className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">
              Extracting...
            </span>
          </div>
        )}
        {extractionError && (
          <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1">
            <AlertCircle className="h-3 w-3 text-destructive" />
            <span className="text-xs text-destructive">
              Extraction failed
            </span>
          </div>
        )}
        {!isExtracting && !extractionError && extraction && (
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1">
            <FileText className="h-3 w-3 text-success" />
            <span className="text-xs text-success">Paper loaded</span>
          </div>
        )}
      </div>

      {/* Extraction summary card */}
      {!isExtracting && extraction && showEmptyState && (
        <ExtractionSummary extraction={extraction} />
      )}

      {/* Error banner */}
      {extractionError && (
        <div className="mx-4 mt-2 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-destructive">
              Extraction failed
            </p>
            <p className="mt-0.5 text-[10px] text-destructive/70 leading-relaxed">
              {extractionError}. You can still view the PDF and ask general
              questions.
            </p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {showEmptyState ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-base font-semibold text-foreground text-balance">
                Research Paper Assistant
              </h2>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed text-pretty">
                {hasDocument
                  ? "Your paper is ready. Ask anything about its content, methodology, or findings."
                  : "Upload a PDF to extract and analyze its content, or ask a general research question."}
              </p>
            </div>

            {hasDocument && extraction && (
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSubmit(prompt)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-2">
            {messages.map((message, i) => (
              <MemoizedMessage
                key={message.id}
                message={message}
                isStreaming={
                  status === "streaming" &&
                  i === messages.length - 1 &&
                  message.role === "assistant"
                }
                onNavigateToPage={onNavigateToPage}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Pending file indicator */}
      {pendingFile && !hasDocument && (
        <div className="mx-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 truncate text-xs text-foreground">
            {pendingFile.name}
          </span>
          <button
            onClick={() => setPendingFile(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Remove pending file"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Suggested prompts after extraction (when chat already has messages) */}
      {!showEmptyState && extraction && !isLoading && (
        <div className="flex gap-2 overflow-x-auto px-4 py-2" style={{ scrollbarWidth: "none" }}>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSubmit(prompt)}
              className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-4">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 transition-colors focus-within:border-primary/50">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            aria-label="Upload PDF"
            disabled={isExtracting}
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Choose PDF file to upload"
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasDocument
                ? "Ask about this paper..."
                : "Upload a PDF or ask a question..."
            }
            rows={1}
            className="flex-1 resize-none bg-transparent py-1 text-sm text-foreground leading-relaxed placeholder:text-muted-foreground focus:outline-none"
            disabled={isLoading}
          />

          <button
            onClick={() => handleSubmit(input)}
            disabled={!input.trim() || isLoading}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
              input.trim() && !isLoading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground"
            )}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Powered by LlamaCloud extraction and GPT-4o
        </p>
      </div>
    </div>
  )
}
