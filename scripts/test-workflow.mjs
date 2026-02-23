// Test the workflow endpoint connectivity
const API_KEY = process.env.LLAMA_CLOUD_API_KEY

const urls = [
  "https://api.cloud.llamaindex.ai/api/v1/files?limit=1",
  "https://api.cloud.llamaindex.ai/deployments/llama-spatial-parser/workflows/process-file/run-nowait",
]

for (const url of urls) {
  console.log(`\n--- Testing: ${url} ---`)
  try {
    const res = await fetch(url, {
      method: url.includes("run-nowait") ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: url.includes("run-nowait")
        ? JSON.stringify({ start_event: { file_id: "test-id" } })
        : undefined,
    })
    console.log(`Status: ${res.status} ${res.statusText}`)
    const text = await res.text()
    console.log(`Body: ${text.slice(0, 500)}`)
  } catch (err) {
    console.log(`Error type: ${err.constructor.name}`)
    console.log(`Error message: ${err.message}`)
    if (err.cause) {
      console.log(`Error cause: ${err.cause}`)
      console.log(`Cause type: ${err.cause?.constructor?.name}`)
      console.log(`Cause message: ${err.cause?.message}`)
      console.log(`Cause code: ${err.cause?.code}`)
    }
  }
}
