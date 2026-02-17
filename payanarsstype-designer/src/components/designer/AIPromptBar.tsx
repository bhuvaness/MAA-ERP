import { useState } from "react";
import { Sparkles, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GeneratedField } from "@/services/aiService";

interface AIPromptBarProps {
  onGenerate: (prompt: string) => Promise<GeneratedField[]>;
  onFieldsGenerated?: (fields: GeneratedField[]) => void;
  isLoading?: boolean;
  parentName?: string;
}

export function AIPromptBar({
  onGenerate,
  onFieldsGenerated,
  isLoading = false,
  parentName,
}: AIPromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [internalLoading, setInternalLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const loading = isLoading || internalLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setInternalLoading(true);
    setStatus("idle");
    setStatusMessage("");

    try {
      const fields = await onGenerate(prompt.trim());
      setStatus("success");
      setStatusMessage(`Generated ${fields.length} field${fields.length !== 1 ? "s" : ""}`);
      onFieldsGenerated?.(fields);
      setPrompt("");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatus("idle");
        setStatusMessage("");
      }, 3000);
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Generation failed");
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setStatus("idle");
        setStatusMessage("");
      }, 5000);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <div className="prompt-bar border-t border-border px-6 py-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-accent">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">
            AI Generate
          </span>
        </div>

        <div className="flex-1 relative">
          <Input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              parentName
                ? `Describe fields for ${parentName} (e.g., Customer with Name, Email, Phone)...`
                : "Describe your table structure..."
            }
            disabled={loading}
            className={cn(
              "pr-12 h-11 text-sm",
              loading && "opacity-50"
            )}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className={cn(
              "absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md transition-colors",
              prompt.trim() && !loading
                ? "bg-accent text-accent-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 mt-2 ml-10 min-h-[20px]">
        {status === "success" && (
          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="text-xs">{statusMessage}</span>
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="text-xs">{statusMessage}</span>
          </div>
        )}
        {status === "idle" && (
          <p className="text-xs text-muted-foreground">
            Tip: Describe your data model naturally. E.g., "Employee with FirstName, LastName, Email, Department, JoinDate"
          </p>
        )}
      </div>
    </div>
  );
}
