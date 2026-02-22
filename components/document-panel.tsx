"use client"

import { FileText, Upload, X } from "lucide-react"

interface DocumentPanelProps {
  fileUrl: string | null
  fileName: string | null
  onRemoveFile: () => void
}

export function DocumentPanel({
  fileUrl,
  fileName,
  onRemoveFile,
}: DocumentPanelProps) {
  if (!fileUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
          <Upload className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            No document loaded
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a PDF in the chat to preview it here
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">
            {fileName}
          </span>
        </div>
        <button
          onClick={onRemoveFile}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Remove document"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <iframe
          src={`${fileUrl}#toolbar=1&navpanes=0`}
          className="h-full w-full border-0"
          title={`PDF preview: ${fileName}`}
        />
      </div>
    </div>
  )
}
