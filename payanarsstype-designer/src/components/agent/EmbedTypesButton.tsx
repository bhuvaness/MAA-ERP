import { useState } from "react";
import { Database, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { loadPayanarssTypes, EmbedProgress } from "@/services/pineconeService";
import { supabase } from "@/integrations/supabase/client";

const PINECONE_INDEX_HOST = "payanarss-type-y3f7eec.svc.aped-4627-b74a.pinecone.io";
const BATCH_SIZE = 50; // Smaller batches to avoid timeouts
const MAX_RETRIES = 3;
const DELAY_BETWEEN_BATCHES_MS = 1000;

export function EmbedTypesButton() {
  const [progress, setProgress] = useState<EmbedProgress>({
    totalTypes: 0,
    processedBatches: 0,
    totalBatches: 0,
    status: "idle",
  });

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const embedBatchWithRetry = async (
    batch: any[],
    batchNum: number,
    retries = 0
  ): Promise<{ success: boolean; count: number }> => {
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

      return { success: true, count: batch.length };
    } catch (err) {
      console.error(`Batch ${batchNum} attempt ${retries + 1} failed:`, err);

      if (retries < MAX_RETRIES) {
        // Exponential backoff
        await sleep(1000 * Math.pow(2, retries));
        return embedBatchWithRetry(batch, batchNum, retries + 1);
      }

      return { success: false, count: 0 };
    }
  };

  const handleEmbed = async () => {
    try {
      setProgress((prev) => ({ ...prev, status: "embedding", error: undefined }));

      // Load types from JSON
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
        description: `Embedding ${allTypes.length} types in ${totalBatches} batches...`,
      });

      let successCount = 0;
      let errorCount = 0;

      // Process in batches from client side
      for (let i = 0; i < allTypes.length; i += BATCH_SIZE) {
        const batch = allTypes.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        const result = await embedBatchWithRetry(batch, batchNum);

        if (result.success) {
          successCount += result.count;
        } else {
          errorCount++;
        }

        setProgress((prev) => ({
          ...prev,
          processedBatches: batchNum,
        }));

        // Delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < allTypes.length) {
          await sleep(DELAY_BETWEEN_BATCHES_MS);
        }
      }

      if (errorCount === 0) {
        setProgress((prev) => ({ ...prev, status: "complete" }));
        toast({
          title: "Embedding Complete",
          description: `Successfully embedded ${successCount} types.`,
        });
      } else {
        setProgress((prev) => ({
          ...prev,
          status: "error",
          error: `${errorCount} batch(es) failed after retries. ${successCount} types embedded.`,
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
        </div>
      )}

      {progress.status === "error" && progress.error && (
        <p className="text-xs text-destructive">{progress.error}</p>
      )}
    </div>
  );
}
