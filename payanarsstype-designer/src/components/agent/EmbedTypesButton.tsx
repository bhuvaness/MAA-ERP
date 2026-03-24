import { useState } from "react";
import { Database, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { loadPayanarssTypes, EmbedProgress } from "@/services/pineconeService";
import { supabase } from "@/integrations/supabase/client";

const PINECONE_INDEX_HOST = "maa-erp-types-y3f7eec.svc.aped-4627-b74a.pinecone.io";
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const DELAY_BETWEEN_BATCHES_MS = 1000;

export function EmbedTypesButton() {
  const [progress, setProgress] = useState<EmbedProgress>({
    totalTypes: 0,
    processedBatches: 0,
    totalBatches: 0,
    status: "idle",
  });
  const [lastResult, setLastResult] = useState<{
    processed: number;
    skipped: number;
    method: string;
  } | null>(null);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const embedBatchWithRetry = async (
    batch: unknown[],
    batchNum: number,
    retries = 0
  ): Promise<{ success: boolean; count: number; skipped: number; method: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("embed-types", {
        body: {
          types: batch,
          indexHost: PINECONE_INDEX_HOST,
        },
      });

      if (error) {
        throw new Error(error.message || "Edge function error");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Embedding failed");
      }

      return {
        success: true,
        count: data.totalProcessed || batch.length,
        skipped: data.totalSkipped || 0,
        method: data.method || 'unknown',
      };
    } catch (err) {
      console.error(`Batch ${batchNum} attempt ${retries + 1} failed:`, err);

      if (retries < MAX_RETRIES) {
        await sleep(1000 * Math.pow(2, retries));
        return embedBatchWithRetry(batch, batchNum, retries + 1);
      }

      return { success: false, count: 0, skipped: 0, method: 'failed' };
    }
  };

  const handleEmbed = async () => {
    try {
      setProgress((prev) => ({ ...prev, status: "embedding", error: undefined }));
      setLastResult(null);

      const allTypes = await loadPayanarssTypes();
      const totalBatches = Math.ceil(allTypes.length / BATCH_SIZE);

      setProgress({
        totalTypes: allTypes.length,
        processedBatches: 0,
        totalBatches,
        status: "embedding",
      });

      toast({
        title: "Starting Embedding",
        description: `Processing ${allTypes.length} types in ${totalBatches} batches (only embeddable levels will be stored)...`,
      });

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let method = 'unknown';

      for (let i = 0; i < allTypes.length; i += BATCH_SIZE) {
        const batch = allTypes.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        const result = await embedBatchWithRetry(batch, batchNum);

        if (result.success) {
          successCount += result.count;
          skippedCount += result.skipped;
          method = result.method;
        } else {
          errorCount++;
        }

        setProgress((prev) => ({
          ...prev,
          processedBatches: batchNum,
        }));

        if (i + BATCH_SIZE < allTypes.length) {
          await sleep(DELAY_BETWEEN_BATCHES_MS);
        }
      }

      setLastResult({ processed: successCount, skipped: skippedCount, method });

      if (errorCount === 0) {
        setProgress((prev) => ({ ...prev, status: "complete" }));
        toast({
          title: "Embedding Complete",
          description: `${successCount} types embedded, ${skippedCount} skipped (columns/rules). Method: ${method}`,
        });
      } else {
        setProgress((prev) => ({
          ...prev,
          status: "error",
          error: `${errorCount} batch(es) failed. ${successCount} types embedded.`,
        }));
        toast({
          title: "Embedding Partially Complete",
          description: `${successCount} types embedded, ${errorCount} batch(es) failed.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Embedding Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setProgress((prev) => ({ ...prev, status: "error", error: errorMessage }));
    }
  };

  const progressPercent =
    progress.totalBatches > 0
      ? (progress.processedBatches / progress.totalBatches) * 100
      : 0;

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={handleEmbed}
        disabled={progress.status === "embedding"}
        variant={progress.status === "complete" ? "outline" : "default"}
        className="gap-2"
      >
        {progress.status === "embedding" && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {progress.status === "complete" && (
          <Check className="h-4 w-4 text-green-500" />
        )}
        {progress.status === "error" && (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        {progress.status === "idle" && <Database className="h-4 w-4" />}

        {progress.status === "embedding"
          ? `Embedding... (${progress.processedBatches}/${progress.totalBatches})`
          : progress.status === "complete"
          ? "Embedded Successfully"
          : progress.status === "error"
          ? "Retry Embedding"
          : "Embed All Types to Pinecone"}
      </Button>

      {progress.status === "embedding" && (
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Batch {progress.processedBatches} of {progress.totalBatches} ({progress.totalTypes} types total)
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Only sector/module/submodule/usecase/table levels are embedded. Columns are stored as metadata.
          </p>
        </div>
      )}

      {progress.status === "error" && progress.error && (
        <p className="text-xs text-destructive">{progress.error}</p>
      )}

      {lastResult && progress.status === "complete" && (
        <div className="text-xs text-muted-foreground space-y-1 p-2 rounded bg-muted">
          <p>✅ Embedded: <strong>{lastResult.processed}</strong> nodes</p>
          <p>⏭️ Skipped: <strong>{lastResult.skipped}</strong> (columns, rules — stored as metadata)</p>
          <p>🔧 Method: <strong>{lastResult.method}</strong></p>
        </div>
      )}
    </div>
  );
}
