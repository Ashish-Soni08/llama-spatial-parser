import { NextResponse } from "next/server"

const LLAMA_CLOUD_BASE = "https://api.cloud.llamaindex.ai"
const DEPLOYMENT_BASE = `${LLAMA_CLOUD_BASE}/deployments/llama-spatial-parser`

export const maxDuration = 120

export async function POST(req: Request) {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "LLAMA_CLOUD_API_KEY is not configured" },
      { status: 500 }
    )
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      )
    }

    // Step 1: Upload file to LlamaCloud
    const uploadForm = new FormData()
    uploadForm.append("file", file)
    uploadForm.append("purpose", "user_data")

    const uploadRes = await fetch(`${LLAMA_CLOUD_BASE}/api/v1/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadForm,
    })

    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      return NextResponse.json(
        { error: `File upload failed: ${text}` },
        { status: uploadRes.status }
      )
    }

    const uploadData = await uploadRes.json()
    const fileId = uploadData.id

    // Step 2: Trigger the process-file workflow
    const workflowRes = await fetch(
      `${DEPLOYMENT_BASE}/workflows/process-file/run`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file_id: fileId }),
      }
    )

    if (!workflowRes.ok) {
      const text = await workflowRes.text()
      return NextResponse.json(
        { error: `Workflow trigger failed: ${text}` },
        { status: workflowRes.status }
      )
    }

    const workflowData = await workflowRes.json()
    const handlerId = workflowData.handler_id

    // Step 3: Poll for workflow completion
    const maxAttempts = 60
    const pollInterval = 2000

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))

      const statusRes = await fetch(
        `${DEPLOYMENT_BASE}/workflows/process-file/handlers/${handlerId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      )

      if (!statusRes.ok) continue

      const statusData = await statusRes.json()

      if (statusData.status === "completed" || statusData.result) {
        let extraction = statusData.result
        if (typeof extraction === "string") {
          try {
            extraction = JSON.parse(extraction)
          } catch {
            // result is already a string, wrap it
          }
        }

        return NextResponse.json({
          fileId,
          handlerId,
          extraction,
        })
      }

      if (statusData.status === "failed" || statusData.status === "error") {
        return NextResponse.json(
          { error: "Workflow failed", details: statusData },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: "Workflow timed out after 2 minutes" },
      { status: 504 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
