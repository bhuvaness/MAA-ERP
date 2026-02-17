import { Brain, Home, Bot } from "lucide-react";
import { Link } from "react-router-dom";

interface HeaderProps {
  onNavigateHome: () => void;
}

export function Header({ onNavigateHome }: HeaderProps) {
  return (
    <header className="header-gradient text-primary-foreground px-6 py-4 shadow-lg flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6" />
        <h1 className="text-xl font-semibold tracking-tight">
          Payanarss Type Designer
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-primary-foreground/60 hidden sm:inline">
          v1.0 — Metadata Architecture
        </span>
        <Link
          to="/agent"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors text-sm"
        >
          <Bot className="w-4 h-4" />
          <span>AI Agent</span>
        </Link>
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors text-sm"
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>
      </div>
    </header>
  );
}
