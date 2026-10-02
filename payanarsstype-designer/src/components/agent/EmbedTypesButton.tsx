/**
 * EmbedTypesButton.tsx
 * ====================
 * Admin button on AgentPage for embedding all PayanarssTypes into Pinecone.
 * Uses the three-layer embedding strategy (ancestry / activated_context / path).
 * Direct browser → Pinecone — no Supabase edge functions.
 */

import { useState } from "react";
import { Database, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { embedTypes, loadPayanarssTypes, EmbedProgress } from "@/services/pineconeService";
import { toast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<EmbedProgress["status"], string> = {
  idle: "Embed All Types",
  enriching: "Enriching hierarchy...",
  embedding: "Generating vectors...",
  upserting: "Upserting to Pinecone...",
  complete: "Embedding Complete",
  error: "Embedding Failed — Retry",
};

export function EmbedTypesButton() {
  const [progress, setProgress] = useState<EmbedProgress>({
    totalNodes: 0,
    totalVectors: 0,
    embeddedVectors: 0,
    skippedNodes: 0,
    currentBatch: 0,
    totalBatches: 0,
    status: "idle",
  });
  const [showDetails, setShowDetails] = useState(false);

  const isRunning =
    progress.status === "enriching" ||
    progress.status === "embedding" ||
    progress.status === "upserting";

  const progressPercent =
    progress.totalBatches > 0
      ? Math.round((progress.currentBatch / progress.totalBatches) * 100)
      : progress.status === "enriching"
      ? 5
      : 0;

  const handleEmbed = async () => {
    try {
      const allTypes = await loadPayanarssTypes();

      toast({
        title: "Embedding Started",
        description: `Loaded ${allTypes.length} PayanarssTypes. Building three-layer vectors...`,
      });

      await embedTypes(allTypes, (p) => {
        setProgress(p);
      });

      toast({
        title: "✓ Embedding Complete",
        description: `${progress.totalVectors} vectors embedded using 3-layer strategy.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setProgress((p) => ({ ...p, status: "error", error: msg }));
      toast({
        title: "Embedding Failed",
        description: msg,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Main button */}
      <Button
        onClick={handleEmbed}
        disabled={isRunning}
        className="w-full gap-2"
        variant={
          progress.status === "complete"
            ? "outline"
            : progress.status === "error"
            ? "destructive"
            : "default"
        }
      >
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : progress.status === "complete" ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : progress.status === "error" ? (
          <XCircle className="h-4 w-4" />
        ) : (
          <Database className="h-4 w-4" />
        )}
        {STATUS_LABEL[progress.status]}
      </Button>

      {/* Progress bar — shown while running */}
      {isRunning && progress.totalBatches > 0 && (
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {progress.status === "embedding"
              ? `Embedding batch ${progress.currentBatch} / ${progress.totalBatches}`
              : progress.status === "upserting"
              ? `Upserting batch ${progress.currentBatch} / ${progress.totalBatches}`
              : "Enriching nodes..."}
          </p>
        </div>
      )}

      {/* Summary — shown on complete */}
      {progress.status === "complete" && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-green-800">Embedding Summary</span>
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="text-green-700 hover:text-green-900 flex items-center gap-1 text-xs"
            >
              {showDetails ? (
                <>Less <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Details <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          </div>

          {showDetails && (
            <div className="space-y-0.5 text-xs text-green-700 pt-1">
              <div className="flex justify-between">
                <span>Source nodes</span>
                <span className="font-mono">{progress.totalNodes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Vectors stored</span>
                <span className="font-mono">{progress.totalVectors.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped (columns / root)</span>
                <span className="font-mono">{progress.skippedNodes.toLocaleString()}</span>
              </div>
              <div className="pt-1 border-t border-green-200 text-green-600 italic">
                3-layer strategy: ancestry + activated_context + path
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error detail */}
      {progress.status === "error" && progress.error && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded p-2">
          {progress.error}
        </p>
      )}

      {/* Strategy info — idle state */}
      {progress.status === "idle" && (
        <div className="text-xs text-muted-foreground space-y-1 pt-1">
          <p className="font-medium">Three-layer embedding per node:</p>
          <ul className="space-y-0.5 list-none pl-0">
            <li>
              <span className="text-blue-600 font-mono">ancestry</span> — node + children list
              (top-down discovery)
            </li>
            <li>
              <span className="text-purple-600 font-mono">activated_context</span> — parent +
              ActivationRule + branch conditions (RAG)
            </li>
            <li>
              <span className="text-cyan-600 font-mono">path</span> — breadcrumb string
              (navigation)
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
