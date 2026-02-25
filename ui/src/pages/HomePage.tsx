import {
  ItemCount,
  WorkflowTrigger,
  ExtractedDataItemGrid,
  HandlerState,
  AgentDataItem,
} from "@llamaindex/ui";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { WorkflowProgress } from "@/lib/WorkflowProgress";
import { Sparkles, FileSearch, BookOpenCheck } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();
  const [reloadSignal, setReloadSignal] = useState(0);
  const [handlers, setHandlers] = useState<HandlerState[]>([]);

  const cards = useMemo(
    () => [
      {
        title: "Research papers indexed",
        description: "Documents available for grounded Q&A.",
        icon: FileSearch,
        metric: (
          <ItemCount title="Total Items" key={`total-items-${reloadSignal}`} />
        ),
      },
      {
        title: "Ready for Q&A",
        description: "Papers with completed extraction and review.",
        icon: BookOpenCheck,
        metric: (
          <ItemCount
            title="Ready"
            filter={{ status: { includes: ["approved", "pending_review"] } }}
            key={`ready-items-${reloadSignal}`}
          />
        ),
      },
      {
        title: "Human-reviewed",
        description: "Items already approved or rejected.",
        icon: Sparkles,
        metric: (
          <ItemCount
            title="Reviewed"
            filter={{ status: { includes: ["approved", "rejected"] } }}
            key={`reviewed-${reloadSignal}`}
          />
        ),
      },
    ],
    [reloadSignal],
  );

  const goToItem = (item: AgentDataItem) => {
    navigate(`/item/${item.id}`);
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white p-6 md:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Research Assistant Workspace
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Upload papers, run extraction, and open any paper to ask grounded
            questions with visual evidence linked to source pages.
          </p>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-xl">
              <WorkflowProgress
                workflowName="process-file"
                handlers={handlers}
                onWorkflowCompletion={() => {
                  setReloadSignal((value) => value + 1);
                }}
              />
            </div>

            <WorkflowTrigger
              workflowName="process-file"
              contentHash={{ enabled: true }}
              customWorkflowInput={(files) => ({
                file_id: files[0].fileId,
                file_hash: files[0].contentHash ?? null,
              })}
              onSuccess={(handler) => {
                setHandlers((prev) => [...prev, handler]);
              }}
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium text-slate-500">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {card.description}
                  </p>
                </div>
                <card.icon className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-4 text-3xl font-semibold text-slate-900 [&_h3]:hidden">
                {card.metric}
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 px-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Paper library
            </h2>
            <p className="text-sm text-slate-600">
              Select a paper to open the grounded question-answering view.
            </p>
          </div>

          <ExtractedDataItemGrid
            key={reloadSignal}
            onRowClick={goToItem}
            builtInColumns={{
              fileName: true,
              status: true,
              createdAt: true,
              itemsToReview: true,
              actions: true,
            }}
          />
        </section>
      </div>
    </div>
  );
}
