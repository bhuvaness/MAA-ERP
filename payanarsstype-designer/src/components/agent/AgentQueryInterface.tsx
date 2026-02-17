import { useState } from "react";
import { Search, Loader2, Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { queryTypes, QueryResult, QueryResponse } from "@/services/pineconeService";
import { toast } from "@/hooks/use-toast";

export function AgentQueryInterface() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<QueryResponse | null>(null);

  const handleQuery = async () => {
    if (!query.trim()) {
      toast({
        title: "Empty Query",
        description: "Please describe your software requirements.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await queryTypes(query, 15);
      setResponse(result);

      if (!result.success) {
        toast({
          title: "Query Failed",
          description: result.error || "Failed to query types",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500/10 text-green-700 border-green-500/20";
    if (score >= 0.6) return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-6">
      {/* Query Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Describe Your Software Requirements
          </CardTitle>
          <CardDescription>
            Tell me what kind of software or business system you want to build, 
            and I'll find the most relevant data types for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Example: I need a tenancy management system with lease tracking, rent collection, and maintenance requests..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[120px] resize-none"
          />
          <Button
            onClick={handleQuery}
            disabled={isLoading || !query.trim()}
            className="w-full gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isLoading ? "Searching..." : "Find Matching Types"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {response && response.success && (
        <>
          {/* Detected Domain Badge */}
          {response.detectedDomain && response.detectedDomain !== 'General' && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                Detected Domain: {response.detectedDomain}
              </Badge>
            </div>
          )}

          {/* AI Summary */}
          {response.aiSummary && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                  {response.aiSummary}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Matching Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Matching PayanarssTypes
                <Badge variant="secondary" className="ml-2">
                  {response.results.length} found
                </Badge>
              </CardTitle>
              <CardDescription>
                Types ranked by semantic similarity to your requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {response.results.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No matching types found. Try a different description.
                </p>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {response.results.map((result, index) => (
                      <div key={result.id}>
                        <div className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h4 className="font-semibold text-base">{result.metadata.name}</h4>
                              <Badge
                                variant="outline"
                                className={getScoreColor(result.score)}
                              >
                                {(result.score * 100).toFixed(0)}% match
                              </Badge>
                            </div>
                            
                            {/* Enriched metadata badges */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              {result.metadata.purpose && (
                                <Badge variant="secondary" className="text-xs">
                                  {result.metadata.purpose}
                                </Badge>
                              )}
                              {result.metadata.domain && result.metadata.domain !== 'General' && (
                                <Badge variant="outline" className="text-xs">
                                  {result.metadata.domain}
                                </Badge>
                              )}
                              {result.metadata.hasAttributes && (
                                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/20">
                                  Has Attributes
                                </Badge>
                              )}
                              {result.metadata.childCount && result.metadata.childCount > 0 && (
                                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/20">
                                  {result.metadata.childCount} children
                                </Badge>
                              )}
                            </div>

                            {result.metadata.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {result.metadata.description}
                              </p>
                            )}
                            
                            {/* Parent/Module info */}
                            {result.metadata.parentName && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Module:</span> {result.metadata.parentName}
                              </p>
                            )}
                          </div>
                        </div>
                        {index < response.results.length - 1 && (
                          <Separator className="my-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Error State */}
      {response && !response.success && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-destructive">{response.error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
