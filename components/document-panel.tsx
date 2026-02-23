"use client"

import { useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import { FileText, Upload, X } from "lucide-react"

// react-pdf requires browser APIs, so we disable SSR
const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false }
)

interface DocumentPanelProps {
  fileUrl: string | null
  fileName: string | null
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onTotalPagesChange: (total: number) => void
  onRemoveFile: () => void
  onFileUpload: (file: File) => void
}

export function DocumentPanel({
  fileUrl,
  fileName,
  currentPage,
  totalPages,
  onPageChange,
  onTotalPagesChange,
  onRemoveFile,
  onFileUpload,
}: DocumentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file?.type === "application/pdf") {
        onFileUpload(file)
      }
      e.target.value = ""
    },
    [onFileUpload]
  )

  if (!fileUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Choose PDF file to upload"
        />

        <button
          onClick={handleClick}
          className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border p-10 transition-colors hover:border-primary/40 hover:bg-accent/30"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
            <Upload className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              No document loaded
            </p>
            <p className="mt-1 text-xs text-muted-foreground text-pretty">
              Drop a PDF here, click to browse, or upload in the chat
            </p>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalPages > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentPage} / {totalPages}
            </span>
          )}
          <button
            onClick={onRemoveFile}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Remove document"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <PdfViewer
          fileUrl={fileUrl}
          currentPage={currentPage}
          onPageChange={onPageChange}
          onTotalPagesChange={onTotalPagesChange}
        />
      </div>
    </div>
  )
}
