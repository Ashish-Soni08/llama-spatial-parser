const API_KEY = process.env.LLAMA_CLOUD_API_KEY;
const BASE = "https://api.cloud.llamaindex.ai";
const DEPLOY = `${BASE}/deployments/llama-spatial-parser`;

async function main() {
  console.log("API key present:", !!API_KEY);
  console.log("API key length:", API_KEY?.length);

  // Test 1: Files endpoint (we know this works)
  console.log("\n--- Test 1: Files endpoint ---");
  try {
    const r1 = await fetch(`${BASE}/api/v1/files?limit=1`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    console.log("Status:", r1.status);
    const t1 = await r1.text();
    console.log("Body (first 200):", t1.slice(0, 200));
  } catch (e) {
    console.log("Error:", e.message, e.cause);
  }

  // Test 2: Deployment base URL
  console.log("\n--- Test 2: Deployment base ---");
  try {
    const r2 = await fetch(DEPLOY, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    console.log("Status:", r2.status);
    const t2 = await r2.text();
    console.log("Body (first 300):", t2.slice(0, 300));
  } catch (e) {
    console.log("Error:", e.message);
    if (e.cause) console.log("Cause:", e.cause.message || e.cause);
  }

  // Test 3: Workflow run-nowait endpoint with dummy data
  console.log("\n--- Test 3: Workflow trigger ---");
  const url3 = `${DEPLOY}/workflows/process-file/run-nowait`;
  console.log("URL:", url3);
  try {
    const r3 = await fetch(url3, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ start_event: { file_id: "test-123" } }),
    });
    console.log("Status:", r3.status);
    const t3 = await r3.text();
    console.log("Body (first 300):", t3.slice(0, 300));
  } catch (e) {
    console.log("Error:", e.message);
    if (e.cause) console.log("Cause:", e.cause.message || e.cause);
  }

  // Test 4: Try without /workflows/ prefix
  console.log("\n--- Test 4: Alt URL /run-nowait ---");
  const url4 = `${DEPLOY}/run-nowait`;
  console.log("URL:", url4);
  try {
    const r4 = await fetch(url4, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ start_event: { file_id: "test-123" } }),
    });
    console.log("Status:", r4.status);
    const t4 = await r4.text();
    console.log("Body (first 300):", t4.slice(0, 300));
  } catch (e) {
    console.log("Error:", e.message);
    if (e.cause) console.log("Cause:", e.cause.message || e.cause);
  }
}

main().catch(console.error);
