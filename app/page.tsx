"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { ChatPanel } from "@/components/chat-panel"
import { DocumentPanel } from "@/components/document-panel"
import { cn } from "@/lib/utils"

export interface ExtractionData {
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

export default function HomePage() {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<ExtractionData | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [splitPercent, setSplitPercent] = useState(50)
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragCounter = useRef(0)

  const handleFileUpload = useCallback(async (file: File) => {
    setFileName(file.name)
    setExtraction(null)
    setExtractionError(null)
    setIsExtracting(true)

    // Upload PDF to our server so we can serve it via a same-origin URL
    // (blob: URLs are blocked in cross-origin iframes)
    try {
      const pdfForm = new FormData()
      pdfForm.append("file", file)
      const pdfRes = await fetch("/api/pdf", { method: "POST", body: pdfForm })
      if (pdfRes.ok) {
        const { id } = await pdfRes.json()
        setFileUrl(`/api/pdf?id=${id}`)
      } else {
        // Fallback to blob URL if server storage fails
        setFileUrl(URL.createObjectURL(file))
      }
    } catch {
      setFileUrl(URL.createObjectURL(file))
    }

    // Trigger LlamaCloud extraction in parallel
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Upload failed")
      }

      const data = await res.json()
      setExtraction(data.extraction)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Extraction failed"
      setExtractionError(message)
    } finally {
      setIsExtracting(false)
    }
  }, [])

  const handleRemoveFile = useCallback(() => {
    if (fileUrl?.startsWith("blob:")) URL.revokeObjectURL(fileUrl)
    setFileUrl(null)
    setFileName(null)
    setExtraction(null)
    setExtractionError(null)
    setIsExtracting(false)
  }, [fileUrl])

  // Resizable splitter
  const handleSplitterPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setIsDraggingSplitter(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    []
  )

  const handleSplitterPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingSplitter || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setSplitPercent(Math.min(Math.max(pct, 25), 75))
    },
    [isDraggingSplitter]
  )

  const handleSplitterPointerUp = useCallback(() => {
    setIsDraggingSplitter(false)
  }, [])

  // Global drag-and-drop for PDF files
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDraggingFile(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current = 0
      setIsDraggingFile(false)
      const file = e.dataTransfer.files[0]
      if (file?.type === "application/pdf") {
        handleFileUpload(file)
      }
    },
    [handleFileUpload]
  )

  // Keyboard shortcut to reset split
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault()
        setSplitPercent(50)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <main
      ref={containerRef}
      className="relative flex h-dvh w-full overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Global drop overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-card p-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              Drop your PDF here
            </p>
          </div>
        </div>
      )}

      {/* Left panel: Chat */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: `${splitPercent}%` }}
      >
        <ChatPanel
          extraction={extraction}
          isExtracting={isExtracting}
          extractionError={extractionError}
          onFileUpload={handleFileUpload}
          hasDocument={!!fileUrl}
        />
      </div>

      {/* Resizable divider */}
      <div
        onPointerDown={handleSplitterPointerDown}
        onPointerMove={handleSplitterPointerMove}
        onPointerUp={handleSplitterPointerUp}
        className={cn(
          "relative z-10 flex w-1 cursor-col-resize items-center justify-center",
          "bg-border transition-colors hover:bg-primary/40",
          isDraggingSplitter && "bg-primary/60"
        )}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(splitPercent)}
        aria-valuemin={25}
        aria-valuemax={75}
        aria-label="Resize panels"
        tabIndex={0}
      >
        <div className="absolute h-8 w-4" />
      </div>

      {/* Right panel: Document */}
      <div
        className="flex flex-col overflow-hidden bg-muted/30"
        style={{ width: `${100 - splitPercent}%` }}
      >
        <DocumentPanel
          fileUrl={fileUrl}
          fileName={fileName}
          onRemoveFile={handleRemoveFile}
          onFileUpload={handleFileUpload}
        />
      </div>
    </main>
  )
}
