"use client"

import { useState, useCallback } from "react"
import { ChatPanel } from "@/components/chat-panel"
import { DocumentPanel } from "@/components/document-panel"

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

export default function HomePage() {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<ExtractionData | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)

  const handleFileUpload = useCallback(async (file: File) => {
    // Show the PDF immediately in the document panel
    const url = URL.createObjectURL(file)
    setFileUrl(url)
    setFileName(file.name)
    setExtraction(null)
    setIsExtracting(true)

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
      console.error("Extraction failed:", error)
      // The PDF is still viewable even if extraction fails
    } finally {
      setIsExtracting(false)
    }
  }, [])

  const handleRemoveFile = useCallback(() => {
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl)
    }
    setFileUrl(null)
    setFileName(null)
    setExtraction(null)
    setIsExtracting(false)
  }, [fileUrl])

  return (
    <main className="flex h-dvh w-full">
      {/* Left panel: Chat */}
      <div className="flex w-1/2 flex-col border-r border-border">
        <ChatPanel
          extraction={extraction}
          isExtracting={isExtracting}
          onFileUpload={handleFileUpload}
          hasDocument={!!fileUrl}
        />
      </div>

      {/* Right panel: Document */}
      <div className="flex w-1/2 flex-col bg-muted/30">
        <DocumentPanel
          fileUrl={fileUrl}
          fileName={fileName}
          onRemoveFile={handleRemoveFile}
        />
      </div>
    </main>
  )
}
