import type { FieldCitation, Highlight } from "@llamaindex/ui";
import { convertBoundingBoxesToHighlights } from "./utils";

export interface GroundedSnippet {
  fieldPath: string;
  value: string;
  citations: FieldCitation[];
  highlights: Highlight[];
}

export interface GroundedAnswer {
  answer: string;
  snippets: GroundedSnippet[];
}

interface FlatField {
  path: string;
  value: string;
  citations: FieldCitation[];
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyValue(item))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${key}: ${stringifyValue(nested)}`)
      .join("; ");
  }
  return String(value);
}

function flattenFields(
  data: unknown,
  metadata: unknown,
  basePath = "",
): FlatField[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const dataObj = data as Record<string, unknown>;
  const metadataObj = (metadata as Record<string, unknown>) ?? {};
  const fields: FlatField[] = [];

  for (const [key, value] of Object.entries(dataObj)) {
    const path = basePath ? `${basePath}.${key}` : key;
    const valueMeta = metadataObj[key] as Record<string, unknown> | undefined;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      fields.push(...flattenFields(value, valueMeta, path));
    }

    const printable = stringifyValue(value).trim();
    if (!printable) {
      continue;
    }

    const citations =
      (valueMeta?.citation as FieldCitation[] | undefined) ??
      (valueMeta?.citations as FieldCitation[] | undefined) ??
      [];

    fields.push({
      path,
      value: printable,
      citations,
    });
  }

  return fields;
}

function scoreField(question: string, field: FlatField): number {
  const normalizedQuestion = question.toLowerCase();
  const normalizedPath = field.path.toLowerCase();
  const normalizedValue = field.value.toLowerCase();

  const questionTokens = normalizedQuestion
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

  let score = 0;

  for (const token of questionTokens) {
    if (normalizedPath.includes(token)) {
      score += 3;
    }
    if (normalizedValue.includes(token)) {
      score += 2;
    }
  }

  if (field.citations.length > 0) {
    score += 1;
  }

  return score;
}

export function buildGroundedAnswer(
  question: string,
  extractedData: Record<string, unknown> | undefined,
  extractedMetadata: Record<string, unknown> | undefined,
): GroundedAnswer {
  if (!question.trim()) {
    return {
      answer:
        "Ask a question about this paper and I will respond with grounded evidence from extracted fields.",
      snippets: [],
    };
  }

  const allFields = flattenFields(extractedData ?? {}, extractedMetadata ?? {});
  const ranked = allFields
    .map((field) => ({ field, score: scoreField(question, field) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ field }) => field);

  if (ranked.length === 0) {
    return {
      answer:
        "I could not find a precise grounded match in the extracted fields yet. Try asking about objective, dataset, methods, metrics, or key findings.",
      snippets: [],
    };
  }

  const snippets = ranked.map((item) => ({
    fieldPath: item.path,
    value: item.value,
    citations: item.citations,
    highlights: convertBoundingBoxesToHighlights(item.citations),
  }));

  const answer = snippets
    .map((snippet, index) => {
      const lead = index === 0 ? "Most relevant" : "Supporting";
      return `${lead} evidence (${snippet.fieldPath}): ${snippet.value}`;
    })
    .join("\n\n");

  return { answer, snippets };
}
