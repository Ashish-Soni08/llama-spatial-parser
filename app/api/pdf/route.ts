import { NextResponse } from "next/server"

// In-memory store for uploaded PDFs (keyed by a random id)
// In production you'd use blob storage, but this works for the session
const pdfStore = new Map<string, { buffer: ArrayBuffer; name: string }>()

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Valid PDF file required" },
        { status: 400 }
      )
    }

    const id = crypto.randomUUID()
    const buffer = await file.arrayBuffer()
    pdfStore.set(id, { buffer, name: file.name })

    return NextResponse.json({ id, name: file.name })
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id || !pdfStore.has(id)) {
    return new NextResponse("Not found", { status: 404 })
  }

  const { buffer, name } = pdfStore.get(id)!

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, max-age=3600",
    },
  })
}
