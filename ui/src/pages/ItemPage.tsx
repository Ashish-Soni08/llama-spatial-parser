import { useEffect, useMemo, useState } from "react";
import {
  AcceptReject,
  FilePreview,
  useItemData,
  type Highlight,
  type ExtractedData,
  Button,
} from "@llamaindex/ui";
import {
  Clock,
  XCircle,
  Download,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useToolbar } from "@/lib/ToolbarContext";
import { useNavigate } from "react-router-dom";
import { modifyJsonSchema } from "@llamaindex/ui/lib";
import { APP_TITLE } from "@/lib/config";
import { downloadExtractedDataItem } from "@/lib/export";
import { useMetadataContext } from "@/lib/MetadataProvider";
import { buildGroundedAnswer, type GroundedAnswer } from "@/lib/qa";

interface ChatTurn {
  id: string;
  question: string;
  answer: GroundedAnswer;
}

const SUGGESTED_QUESTIONS = [
  "What is the core research objective of this paper?",
  "Which dataset and evaluation metrics are used?",
  "What are the main findings and limitations?",
];

function selectSchemaForItem(
  metadata: {
    json_schema: any;
    schemas?: Record<string, any>;
    discriminator_field?: string;
  },
  itemData: any,
): any {
  const { schemas, discriminator_field, json_schema } = metadata;

  if (!schemas || !discriminator_field) {
    return json_schema;
  }

  const discriminatorValue = itemData?.data?.data?.[discriminator_field];

  if (discriminatorValue && schemas[discriminatorValue]) {
    return schemas[discriminatorValue];
  }

  return json_schema;
}

export default function ItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { setButtons, setBreadcrumbs } = useToolbar();
  const [highlight, setHighlight] = useState<Highlight | undefined>(undefined);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const { metadata } = useMetadataContext();

  const itemHookData = useItemData<any>({
    jsonSchema: modifyJsonSchema(metadata.json_schema, {}),
    itemId: itemId as string,
    isMock: false,
  });

  const selectedSchema = useMemo(
    () => selectSchemaForItem(metadata, itemHookData.item),
    [metadata, itemHookData.item],
  );

  const displaySchema = useMemo(
    () => modifyJsonSchema(selectedSchema, {}),
    [selectedSchema],
  );

  const navigate = useNavigate();

  useEffect(() => {
    const extractedData = itemHookData.item?.data as
      | ExtractedData<unknown>
      | undefined;
    const fileName = extractedData?.file_name;
    if (fileName) {
      setBreadcrumbs([
        { label: APP_TITLE, href: "/" },
        {
          label: fileName,
          isCurrentPage: true,
        },
      ]);
    }

    return () => {
      setBreadcrumbs([{ label: APP_TITLE, href: "/" }]);
    };
  }, [itemHookData.item?.data, setBreadcrumbs]);

  useEffect(() => {
    setButtons(() => [
      <div className="ml-auto flex items-center gap-2" key="toolbar-actions">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (itemData) {
              downloadExtractedDataItem(itemData);
            }
          }}
          disabled={!itemData}
          startIcon={<Download className="h-4 w-4" />}
          label="Export JSON"
        />
        <AcceptReject<any>
          itemData={itemHookData}
          onComplete={() => navigate("/")}
        />
      </div>,
    ]);
    return () => {
      setButtons(() => []);
    };
  }, [itemHookData.data, setButtons]);

  const { item: itemData, loading: isLoading, error } = itemHookData;

  const extractedData = itemData?.data as ExtractedData<any> | undefined;
  const extractedFields = extractedData?.data as
    | Record<string, unknown>
    | undefined;
  const extractedMetadata =
    (extractedData?.metadata as Record<string, unknown> | undefined) ?? {};

  const onAsk = (requestedQuestion: string) => {
    const input = requestedQuestion.trim();
    if (!input) {
      return;
    }

    const answer = buildGroundedAnswer(
      input,
      extractedFields,
      extractedMetadata,
    );
    setTurns((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        question: input,
        answer,
      },
    ]);
    setQuestion("");

    const firstHighlight = answer.snippets.flatMap(
      (snippet) => snippet.highlights,
    )[0];
    if (firstHighlight) {
      setHighlight(firstHighlight);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Clock className="mx-auto mb-2 h-8 w-8 animate-spin" />
          <div className="text-sm text-gray-500">
            Loading paper workspace...
          </div>
        </div>
      </div>
    );
  }

  if (error || !itemData || !extractedData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <XCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <div className="text-sm text-gray-500">
            Error loading item: {error || "Item not found"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 bg-slate-100 xl:grid-cols-[1.2fr_1fr]">
      <section className="h-full border-r border-slate-200 bg-white">
        {extractedData.file_id && (
          <FilePreview
            fileId={extractedData.file_id}
            onBoundingBoxClick={(box, pageNumber) => {
              const anyBox = box as {
                x: number;
                y: number;
                w?: number;
                h?: number;
                width?: number;
                height?: number;
              };
              setHighlight({
                page: pageNumber ?? 1,
                x: anyBox.x,
                y: anyBox.y,
                width: anyBox.width ?? anyBox.w ?? 0,
                height: anyBox.height ?? anyBox.h ?? 0,
              });
            }}
            highlight={highlight}
          />
        )}
      </section>

      <section className="flex h-full flex-col border-t border-slate-200 bg-white xl:border-t-0">
        <header className="border-b border-slate-200 p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Sparkles className="h-4 w-4" />
            Grounded Research Q&A
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Ask this paper anything
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Answers are generated from extracted fields and linked back to
            visual citations.
          </p>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {turns.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                Try one of these prompts to start grounded analysis:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => onAsk(prompt)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <article key={turn.id} className="space-y-2">
              <div className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white">
                {turn.question}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="whitespace-pre-line text-sm text-slate-700">
                  {turn.answer.answer}
                </p>

                {turn.answer.snippets.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {turn.answer.snippets.map((snippet, index) => (
                      <button
                        key={`${turn.id}-${snippet.fieldPath}-${index}`}
                        onClick={() => {
                          const first = snippet.highlights[0];
                          if (first) {
                            setHighlight(first);
                          }
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left hover:border-slate-300"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {snippet.fieldPath}
                        </p>
                        <p className="mt-1 text-sm text-slate-800 line-clamp-3">
                          {snippet.value}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {snippet.citations.length > 0
                            ? `${snippet.citations.length} visual citation(s) available`
                            : "No bounding box citation attached"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        <footer className="border-t border-slate-200 p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={2}
              placeholder="Ask about objective, datasets, methods, results, or limitations..."
              className="w-full resize-none rounded-xl border border-slate-300 p-3 text-sm outline-none ring-slate-200 transition focus:border-slate-400 focus:ring"
            />
            <button
              onClick={() => onAsk(question)}
              className="inline-flex h-10 items-center gap-1 rounded-xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700"
            >
              <SendHorizontal className="h-4 w-4" />
              Ask
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Schema loaded with{" "}
            {Object.keys(displaySchema?.properties ?? {}).length} top-level
            fields.
          </p>
        </footer>
      </section>
    </div>
  );
}
