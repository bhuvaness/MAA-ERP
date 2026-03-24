import { useState } from "react";
import { Search, Loader2, Sparkles, FileText, Layers, Database, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { queryTypes, QueryResult, QueryResponse } from "@/services/pineconeService";
import { toast } from "@/hooks/use-toast";

const LEVEL_COLORS: Record<string, string> = {
  sector: "bg-purple-500/10 text-purple-700 border-purple-500/20",
  module: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  submodule: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20",
  usecase: "bg-green-500/10 text-green-700 border-green-500/20",
  table: "bg-orange-500/10 text-orange-700 border-orange-500/20",
};

const LEVEL_ICONS: Record<string, string> = {
  sector: "🏭",
  module: "📦",
  submodule: "📋",
  usecase: "⚙️",
  table: "🗃️",
};

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

  // Group results by level for summary
  const groupByLevel = (results: QueryResult[]) => {
    const groups: Record<string, QueryResult[]> = {};
    for (const r of results) {
      const level = r.metadata?.level || 'unknown';
      if (!groups[level]) groups[level] = [];
      groups[level].push(r);
    }
    return groups;
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-6">
      {/* Query Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Describe Your Business Requirements
          </CardTitle>
          <CardDescription>
            Tell me what kind of business you run, and I'll find the matching 
            modules, use cases, and tables from the PayanarssType library.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Example: I run a gym with personal training, group classes, and a supplement shop..."
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
            {isLoading ? "Searching..." : "Find Matching Modules & Tables"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {response && response.success && (
        <>
          {/* Detected Sector & Method badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {response.detectedSector && response.detectedSector !== 'General' && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                🏭 Sector: {response.detectedSector}
              </Badge>
            )}
            {response.searchMethod && (
              <Badge variant="outline" className="text-xs">
                Search: {response.searchMethod}
              </Badge>
            )}
            <Badge variant="secondary">
              {response.results.length} results
            </Badge>
          </div>

          {/* Quick Stats */}
          {response.results.length > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(groupByLevel(response.results)).map(([level, items]) => (
                <Card key={level} className="text-center p-3">
                  <div className="text-2xl">{LEVEL_ICONS[level] || '📄'}</div>
                  <div className="text-lg font-bold">{items.length}</div>
                  <div className="text-xs text-muted-foreground capitalize">{level}s</div>
                </Card>
              ))}
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
                <FolderTree className="h-5 w-5" />
                Matching PayanarssTypes
              </CardTitle>
              <CardDescription>
                Results ranked by relevance to your requirements
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
                            {/* Name + Score */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="text-lg">{LEVEL_ICONS[result.metadata?.level] || '📄'}</span>
                              <h4 className="font-semibold text-base">{result.metadata?.name}</h4>
                              <Badge
                                variant="outline"
                                className={getScoreColor(result.score)}
                              >
                                {(result.score * 100).toFixed(0)}% match
                              </Badge>
                            </div>
                            
                            {/* Level + Sector + Common badges */}
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              {result.metadata?.level && (
                                <Badge variant="outline" className={`text-xs capitalize ${LEVEL_COLORS[result.metadata.level] || ''}`}>
                                  {result.metadata.level}
                                </Badge>
                              )}
                              {result.metadata?.sector && (
                                <Badge variant="outline" className="text-xs">
                                  {result.metadata.sector}
                                </Badge>
                              )}
                              {result.metadata?.is_common && (
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/20">
                                  ⭐ Common (always included)
                                </Badge>
                              )}
                              {result.metadata?.table_count > 0 && result.metadata?.level !== 'table' && (
                                <Badge variant="outline" className="text-xs">
                                  <Database className="h-3 w-3 mr-1" />
                                  {result.metadata.table_count} tables
                                </Badge>
                              )}
                              {result.metadata?.column_count > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Layers className="h-3 w-3 mr-1" />
                                  {result.metadata.column_count} columns
                                </Badge>
                              )}
                            </div>

                            {/* Description */}
                            {result.metadata?.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {result.metadata.description}
                              </p>
                            )}

                            {/* Path breadcrumb */}
                            {result.metadata?.path && (
                              <p className="text-xs text-muted-foreground mb-1 font-mono">
                                📍 {result.metadata.path}
                              </p>
                            )}
                            
                            {/* Column names for tables */}
                            {result.metadata?.column_names && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {result.metadata.column_names.split(',').slice(0, 10).map((col, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                    {col}
                                  </span>
                                ))}
                                {result.metadata.column_names.split(',').length > 10 && (
                                  <span className="text-xs px-2 py-0.5 text-muted-foreground">
                                    +{result.metadata.column_names.split(',').length - 10} more
                                  </span>
                                )}
                              </div>
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
