import { useState } from "react";
import { Bot, Database, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmbedTypesButton } from "@/components/agent/EmbedTypesButton";
import { AgentQueryInterface } from "@/components/agent/AgentQueryInterface";
import { Link } from "react-router-dom";

export default function AgentPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Designer
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Payanarss AI Agent</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="query" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="query" className="gap-2">
              <Bot className="h-4 w-4" />
              Query Agent
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-2">
              <Database className="h-4 w-4" />
              Admin
            </TabsTrigger>
          </TabsList>

          <TabsContent value="query">
            <AgentQueryInterface />
          </TabsContent>

          <TabsContent value="admin">
            <div className="max-w-xl mx-auto">
              <div className="bg-card border rounded-lg p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Vector Database Management</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Embed all PayanarssTypes into Pinecone for semantic search capabilities.
                    This process creates vector embeddings for each type using the following fields:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mb-6">
                    <li><strong>Id</strong> - Unique identifier</li>
                    <li><strong>ParentId</strong> - Parent type reference for hierarchy</li>
                    <li><strong>Description</strong> - Detailed type description</li>
                    <li><strong>PayanarssTypeId</strong> - Type category reference</li>
                    <li><strong>Attributes</strong> - Business rules and constraints</li>
                  </ul>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-medium mb-2">Pinecone Configuration</h3>
                  <div className="text-sm space-y-1 font-mono">
                    <p>Index: <span className="text-primary">payanarss-type</span></p>
                    <p>Model: <span className="text-primary">multilingual-e5-large</span></p>
                    <p>Namespace: <span className="text-primary">payanarss-types</span></p>
                  </div>
                </div>

                <EmbedTypesButton />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
