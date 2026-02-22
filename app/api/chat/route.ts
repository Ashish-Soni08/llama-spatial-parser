import {
  consumeStream,
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai"

export const maxDuration = 60

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

function buildSystemPrompt(extraction?: ExtractionData | null): string {
  const base = `You are a brilliant research paper analyst. You help researchers understand, analyze, and discuss academic papers with precision and clarity.

Your strengths:
- Breaking down complex methodology into understandable explanations
- Identifying the significance of key findings
- Comparing approaches with related work in the field
- Spotting strengths, limitations, and potential future directions
- Explaining technical concepts at the level the user needs

Be concise but thorough. Use markdown formatting for structure. When referencing specific parts of the paper, be precise about which section, figure, or table you're discussing.`

  if (!extraction) {
    return `${base}

No paper has been uploaded yet. Greet the user and let them know they can upload a research paper (PDF) to get started. You can answer general research methodology questions in the meantime.`
  }

  const parts: string[] = [base, "\n--- EXTRACTED PAPER DATA ---\n"]

  if (extraction.title) {
    parts.push(`**Title:** ${extraction.title}`)
  }

  if (extraction.authors?.length) {
    const authorList = extraction.authors
      .map((a) => `${a.name}${a.affiliation ? ` (${a.affiliation})` : ""}`)
      .join(", ")
    parts.push(`**Authors:** ${authorList}`)
  }

  if (extraction.abstract) {
    parts.push(`\n**Abstract:**\n${extraction.abstract}`)
  }

  if (extraction.sections?.length) {
    parts.push("\n**Sections:**")
    for (const section of extraction.sections) {
      parts.push(`\n### ${section.heading}\n${section.content}`)
    }
  }

  if (extraction.figures?.length) {
    parts.push("\n**Figures:**")
    for (const fig of extraction.figures) {
      parts.push(`- ${fig.figure_id}: ${fig.caption}`)
    }
  }

  if (extraction.tables?.length) {
    parts.push("\n**Tables:**")
    for (const table of extraction.tables) {
      parts.push(
        `- ${table.table_id}${table.caption ? `: ${table.caption}` : ""}\n  ${table.content}`
      )
    }
  }

  if (extraction.key_findings?.length) {
    parts.push("\n**Key Findings:**")
    for (const finding of extraction.key_findings) {
      parts.push(`- ${finding}`)
    }
  }

  if (extraction.references_count != null) {
    parts.push(`\n**References:** ${extraction.references_count} citations`)
  }

  parts.push(
    "\n--- END EXTRACTED DATA ---\n\nYou now have the full structured content of this paper. Answer questions with specific references to sections, figures, and findings. Be the best research assistant the user has ever had."
  )

  return parts.join("\n")
}

export async function POST(req: Request) {
  const {
    messages,
    extraction,
  }: { messages: UIMessage[]; extraction?: ExtractionData | null } =
    await req.json()

  const result = streamText({
    model: "openai/gpt-4o",
    system: buildSystemPrompt(extraction),
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
