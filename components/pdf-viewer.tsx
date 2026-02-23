"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Configure PDF.js worker from CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfViewerProps {
  fileUrl: string
  currentPage: number
  onPageChange: (page: number) => void
  onTotalPagesChange: (total: number) => void
}

export function PdfViewer({
  fileUrl,
  currentPage,
  onPageChange,
  onTotalPagesChange,
}: PdfViewerProps) {
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [pageInputValue, setPageInputValue] = useState(String(currentPage))
  const [isLoading, setIsLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Track container width for responsive page sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Sync external page changes to input
  useEffect(() => {
    setPageInputValue(String(currentPage))
  }, [currentPage])

  const handleDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setTotalPages(numPages)
      onTotalPagesChange(numPages)
      setIsLoading(false)
    },
    [onTotalPagesChange]
  )

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.min(Math.max(1, page), totalPages || 1)
      onPageChange(clamped)
    },
    [totalPages, onPageChange]
  )

  const handlePageInputSubmit = useCallback(() => {
    const parsed = parseInt(pageInputValue, 10)
    if (!isNaN(parsed)) {
      goToPage(parsed)
    } else {
      setPageInputValue(String(currentPage))
    }
  }, [pageInputValue, goToPage, currentPage])

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.25, 3.0))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.25, 0.5))
  }, [])

  const handleResetZoom = useCallback(() => {
    setScale(1.0)
  }, [])

  // Keyboard shortcuts for page navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      )
        return
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        goToPage(currentPage - 1)
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        goToPage(currentPage + 1)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [currentPage, goToPage])

  // Compute page width to fit container
  const pageWidth = containerWidth > 0 ? (containerWidth - 48) * scale : undefined

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card/50 px-3 py-2">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              currentPage <= 1
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="text"
              value={pageInputValue}
              onChange={(e) => setPageInputValue(e.target.value)}
              onBlur={handlePageInputSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePageInputSubmit()
              }}
              className="h-6 w-10 rounded border border-border bg-background px-1.5 text-center text-xs text-foreground focus:border-primary/50 focus:outline-none"
              aria-label="Current page number"
            />
            <span>/</span>
            <span>{totalPages || "..."}</span>
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              currentPage >= totalPages
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              scale <= 0.5
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={handleResetZoom}
            className="flex h-7 items-center justify-center rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              scale >= 3.0
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* PDF content */}
      <div
        ref={containerRef}
        className="flex flex-1 items-start justify-center overflow-auto bg-muted/30 p-6"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center gap-3 py-20">
              <RotateCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Loading PDF...
              </p>
            </div>
          }
          error={
            <div className="flex flex-col items-center gap-3 py-20">
              <Minus className="h-5 w-5 text-destructive" />
              <p className="text-xs text-destructive">
                Failed to load PDF
              </p>
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            width={pageWidth}
            className="shadow-lg"
            renderAnnotationLayer={true}
            renderTextLayer={true}
            loading={
              <div className="flex h-[600px] w-full items-center justify-center">
                <RotateCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }
          />
        </Document>
      </div>
    </div>
  )
}
