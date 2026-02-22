"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ChatMessage } from "@/components/chat-message"
import {
  ArrowUp,
  Paperclip,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ExtractionData {
  title?: string | null
  authors?: Array<{ name: string; affiliation?: string | null }>
  abstract?: string | null
  sections?: Array<{ heading: string; content: string }>
  figures?: Array<{ figure_id: string; caption: string }>
  tables?: Array<{
    table_id: string
    caption?: string | null
    content: string
  }>
  key_findings?: string[]
  references_count?: number | null
}

interface ChatPanelProps {
  extraction: ExtractionData | null
  isExtracting: boolean
  onFileUpload: (file: File) => void
  hasDocument: boolean
}

const SUGGESTED_PROMPTS = [
  "Summarize this paper in 3 key points",
  "What methodology did the authors use?",
  "What are the main findings?",
  "What are the limitations of this study?",
]

export function ChatPanel({
  extraction,
  isExtracting,
  onFileUpload,
  hasDocument,
}: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const { messages, sendMessage, status } = useChat({ transport })

  const isLoading = status === "streaming" || status === "submitted"

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

  function handleSubmit(text: string) {
    if (!text.trim() || isLoading) return
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
            <span className="text-xs text-muted-foreground">Extracting...</span>
          </div>
        )}
        {!isExtracting && extraction && (
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1">
            <FileText className="h-3 w-3 text-success" />
            <span className="text-xs text-success">Paper loaded</span>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {showEmptyState ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-base font-semibold text-foreground">
                Research Paper Assistant
              </h2>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
                Upload a PDF to extract and analyze its content, or ask a
                general research question.
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
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={
                  status === "streaming" && i === messages.length - 1 && message.role === "assistant"
                }
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

      {/* Input area */}
      <div className="border-t border-border p-4">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-primary/50 transition-colors">
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
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed py-1"
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
