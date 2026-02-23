import { NextResponse } from "next/server"

const LLAMA_CLOUD_BASE = "https://api.cloud.llamaindex.ai"
// The deployment name is set when deploying to LlamaCloud.
// Override via LLAMA_DEPLOY_NAME env var if the name has a random suffix.
const DEPLOY_NAME =
  process.env.LLAMA_DEPLOY_NAME || "llama-spatial-parser"
const DEPLOYMENT_BASE = `${LLAMA_CLOUD_BASE}/deployments/${DEPLOY_NAME}`

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
    // The LlamaCloud REST API expects the field name "upload_file"
    const uploadForm = new FormData()
    uploadForm.append("upload_file", file, file.name)
    uploadForm.append("purpose", "user_data")

    console.log("[v0] Uploading file to LlamaCloud:", file.name, file.size, "bytes")

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
    console.log("[v0] File uploaded, id:", fileId)

    // Step 2: Trigger the process-file workflow (run-nowait returns handler_id immediately)
    const workflowUrl = `${DEPLOYMENT_BASE}/workflows/process-file/run-nowait`
    const workflowBody = JSON.stringify({ start_event: { file_id: fileId } })
    console.log("[v0] Triggering workflow at:", workflowUrl)
    console.log("[v0] Workflow body:", workflowBody)

    let workflowRes: Response
    try {
      workflowRes = await fetch(workflowUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: workflowBody,
      })
    } catch (fetchErr) {
      console.log("[v0] Workflow fetch error:", fetchErr)
      return NextResponse.json(
        {
          error: `Workflow connection failed. Check LLAMA_DEPLOY_NAME env var. URL: ${workflowUrl}`,
        },
        { status: 502 }
      )
    }

    if (!workflowRes.ok) {
      const text = await workflowRes.text()
      console.log("[v0] Workflow trigger failed:", workflowRes.status, text)
      return NextResponse.json(
        { error: `Workflow trigger failed: ${text}` },
        { status: workflowRes.status }
      )
    }

    const workflowData = await workflowRes.json()
    const handlerId = workflowData.handler_id
    console.log("[v0] Workflow triggered, handler_id:", handlerId)

    // Step 3: Poll for workflow completion
    const maxAttempts = 60
    const pollInterval = 2000

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))

      const statusRes = await fetch(
        `${DEPLOYMENT_BASE}/handlers/${handlerId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      )

      // 202 = still running, keep polling
      if (statusRes.status === 202) {
        console.log("[v0] Poll", i + 1, "- still running (202)")
        continue
      }
      if (!statusRes.ok) {
        console.log("[v0] Poll", i + 1, "- unexpected status:", statusRes.status)
        continue
      }

      const statusData = await statusRes.json()
      console.log("[v0] Poll", i + 1, "status:", statusData.status, JSON.stringify(statusData).slice(0, 200))

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
