/**
 * VikiBusinessChat Component
 * ==========================
 * The main conversation interface where users describe their business
 * and Viki returns matched PTS metadata.
 *
 * Flow:
 *   1. User types: "I run a gym business"
 *   2. Viki shows matched modules + customer segments
 *   3. User clicks a segment → sees full business config
 */

import React, { useState, useRef, useEffect } from "react";
import { useVikiChat } from "../hooks/useVikiChat";
import type { GymSchemaInfo } from "../services/claudeService";
import PTSTreeView from "./PTSTreeView";

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

/** Customer segment card — clickable */
const SegmentCard: React.FC<{
  name: string;
  description: string;
  subCategories: string[];
  isSelected: boolean;
  onClick: () => void;
}> = ({ name, description, subCategories, isSelected, onClick }) => (
  <div
    className={`viki-segment-card ${isSelected ? "selected" : ""}`}
    onClick={onClick}
  >
    <div className="viki-segment-header">
      <span className="viki-segment-name">{name}</span>
      <span className="viki-segment-badge">{subCategories.length} categories</span>
    </div>
    <div className="viki-segment-desc">{description}</div>
    {isSelected && subCategories.length > 0 && (
      <div className="viki-segment-details">
        {subCategories.map((sub, i) => {
          const [catName, ...rest] = sub.split(": ");
          return (
            <div key={i} className="viki-segment-sub">
              <span className="viki-sub-label">{catName}</span>
              <span className="viki-sub-value">{rest.join(": ")}</span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

/** Phase card — lifecycle phase from Gym Schema */
const PhaseCard: React.FC<{
  name: string;
  nodeCount: number;
  children: string[];
}> = ({ name, nodeCount, children }) => (
  <div className="viki-phase-card">
    <div className="viki-phase-header">
      <span className="viki-phase-name">{name}</span>
      <span className="viki-phase-count">{nodeCount} items</span>
    </div>
    {children.length > 0 && (
      <div className="viki-phase-children">
        {children.slice(0, 5).map((c, i) => (
          <span key={i} className="viki-phase-child">{c}</span>
        ))}
        {children.length > 5 && (
          <span className="viki-phase-more">+{children.length - 5} more</span>
        )}
      </div>
    )}
  </div>
);

/** Matched module from Claude response */
const ModuleCard: React.FC<{
  name: string;
  level: string;
  sector: string;
  description: string;
  children?: string[];
}> = ({ name, level, sector, description, children }) => (
  <div className="viki-module-card">
    <div className="viki-module-header">
      <span className="viki-module-name">{name}</span>
      <span className={`viki-module-level level-${level}`}>{level}</span>
      {sector && <span className="viki-module-sector">{sector}</span>}
    </div>
    <div className="viki-module-desc">{description}</div>
    {children && children.length > 0 && (
      <div className="viki-module-children">
        {children.map((c, i) => (
          <span key={i} className="viki-module-child">{c}</span>
        ))}
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const VikiBusinessChat: React.FC = () => {
  const viki = useVikiChat();
  const [input, setInput] = useState("");
  const [showTree, setShowTree] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-focus input
  useEffect(() => {
    if (viki.phase === "idle" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [viki.phase]);

  // Scroll to results when they appear
  useEffect(() => {
    if (viki.phase === "responded" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [viki.phase]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    await viki.submitPrompt(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Quick example prompts
  const examples = [
    { emoji: "🏋️", text: "I run a gym business with personal training and group classes" },
    { emoji: "🏨", text: "I need a hotel management system with booking and housekeeping" },
    { emoji: "🩺", text: "I run a medical clinic with patient registration and billing" },
    { emoji: "🏗️", text: "I have a construction company with procurement and project management" },
  ];

  return (
    <div className="viki-chat-container">
      {/* ── HEADER ── */}
      <div className="viki-header">
        <div className="viki-avatar">V</div>
        <div className="viki-title">
          <h2>Viki — Business Configurator</h2>
          <p>Powered by PTS (Payanarss Type Script)</p>
        </div>
        {viki.phase !== "idle" && (
          <button className="viki-reset-btn" onClick={viki.reset}>
            ← New query
          </button>
        )}
      </div>

      {/* ── IDLE: Input ── */}
      {viki.phase === "idle" && (
        <div className="viki-input-section">
          <div className="viki-welcome-msg">
            <p>
              Describe your business and I'll find the right modules from our
              PTS library of <strong>13,500+</strong> pre-built business types
              across <strong>19 industries</strong>.
            </p>
          </div>

          <div className="viki-input-wrap">
            <textarea
              ref={inputRef}
              className="viki-textarea"
              placeholder="Example: I run a gym business with member management, class scheduling, attendance..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
            />
            <button
              className="viki-submit-btn"
              onClick={handleSubmit}
              disabled={!input.trim()}
            >
              Ask Viki →
            </button>
          </div>

          <div className="viki-examples">
            <span className="viki-examples-label">Try:</span>
            {examples.map((ex, i) => (
              <button
                key={i}
                className="viki-example-btn"
                onClick={() => {
                  setInput(ex.text);
                  inputRef.current?.focus();
                }}
              >
                {ex.emoji} {ex.text.split(" ").slice(0, 4).join(" ")}...
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── DASHBOARD: Gym Business DB Schema (auto-loaded) ── */}
      {viki.gymSchema && viki.gymSchema.targetCustomerTree && (
        <div className="viki-section viki-dashboard-schema">
          <h3 className="viki-section-title">
            🏋️ Gym Business DB Schema
            <span className="viki-section-count">
              {viki.gymSchema.totalNodes} total nodes
            </span>
          </h3>

          {/* Identify Target Customer Segment */}
          <div className="viki-schema-card">
            <div className="viki-schema-card-header">
              <span className="viki-schema-card-icon">🎯</span>
              <div className="viki-schema-card-info">
                <h4>Identify Target Customer Segment</h4>
                <p>{viki.gymSchema.customerSegments.length} segment types · 99 nodes · tree depth 3</p>
              </div>
              <button
                className="viki-schema-btn"
                onClick={() => setShowTree((v) => !v)}
              >
                {showTree ? "Hide" : "View"} DB Schema
              </button>
            </div>

            {/* Tree View */}
            {showTree && (
              <PTSTreeView
                tree={viki.gymSchema.targetCustomerTree}
                title="🗃️ TargetCustomer — Tables, Columns & Rules"
                onBack={() => setShowTree(false)}
              />
            )}

            {/* Segment chips (quick preview) */}
            {!showTree && (
              <div className="viki-segment-chips">
                {viki.gymSchema.customerSegments.map((seg) => (
                  <span
                    key={seg.name}
                    className={`viki-segment-chip ${viki.selectedSegment === seg.name ? "selected" : ""}`}
                    onClick={() =>
                      viki.selectedSegment === seg.name
                        ? viki.clearSegment()
                        : viki.selectSegment(seg.name)
                    }
                  >
                    {seg.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── THINKING: Loading ── */}
      {viki.phase === "thinking" && (
        <div className="viki-thinking">
          <div className="viki-thinking-dots">
            <span></span><span></span><span></span>
          </div>
          <p>Viki is reading the PTS library...</p>
          <p className="viki-thinking-sub">
            Analyzing 13,500+ business types to find the best match for:<br />
            <em>"{viki.userPrompt}"</em>
          </p>
        </div>
      )}

      {/* ── ERROR ── */}
      {viki.phase === "error" && (
        <div className="viki-error">
          <p className="viki-error-title">⚠️ Something went wrong</p>
          <p>{viki.error}</p>
          {viki.error?.includes("API_KEY") && (
            <div className="viki-error-help">
              <p>Add this to your <code>.env</code> file:</p>
              <code>VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here</code>
            </div>
          )}
          <button className="viki-reset-btn" onClick={viki.reset}>
            Try again
          </button>
        </div>
      )}

      {/* ── RESPONDED: Results ── */}
      {(viki.phase === "responded" || viki.phase === "drilldown") && viki.response && (
        <div className="viki-results" ref={resultsRef}>
          {/* User's prompt */}
          <div className="viki-user-prompt">
            <span className="viki-user-label">You:</span>
            <span>{viki.userPrompt}</span>
          </div>

          {/* Viki's answer */}
          <div className="viki-answer">
            <div className="viki-answer-avatar">V</div>
            <div className="viki-answer-text">
              {viki.response.answer.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>

          {/* Customer Segments (expanded view — when user queries) */}
          {viki.gymSchema && viki.gymSchema.customerSegments.length > 0 && (
            <div className="viki-section">
              <h3 className="viki-section-title">
                🎯 Identify Target Customer Segment
                <span className="viki-section-count">
                  {viki.gymSchema.customerSegments.length} types
                </span>
              </h3>
              <p className="viki-section-desc">
                Select your gym type. Each selection loads tailored Equipment, Staffing,
                Facility, Marketing, Pricing, and Revenue Model configurations.
              </p>

              <div className="viki-segments-grid">
                {viki.gymSchema.customerSegments.map((seg) => (
                  <SegmentCard
                    key={seg.name}
                    name={seg.name}
                    description={seg.description}
                    subCategories={seg.subCategories}
                    isSelected={viki.selectedSegment === seg.name}
                    onClick={() =>
                      viki.selectedSegment === seg.name
                        ? viki.clearSegment()
                        : viki.selectSegment(seg.name)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Gym Lifecycle Phases */}
          {viki.gymSchema && viki.gymSchema.phases.length > 0 && (
            <div className="viki-section">
              <h3 className="viki-section-title">
                📋 Gym Business Lifecycle
                <span className="viki-section-count">
                  {viki.gymSchema.totalNodes} total nodes
                </span>
              </h3>
              <div className="viki-phases-grid">
                {viki.gymSchema.phases.map((phase) => (
                  <PhaseCard
                    key={phase.name}
                    name={phase.name}
                    nodeCount={phase.nodeCount}
                    children={phase.children}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Matched Modules from Claude */}
          {viki.response.matchedModules.length > 0 && (
            <div className="viki-section">
              <h3 className="viki-section-title">
                📦 Recommended Modules
                <span className="viki-section-count">
                  {viki.response.matchedModules.length} modules
                </span>
              </h3>
              <div className="viki-modules-grid">
                {viki.response.matchedModules.map((mod, i) => (
                  <ModuleCard
                    key={i}
                    name={mod.name}
                    level={mod.level}
                    sector={mod.sector}
                    description={mod.description}
                    children={mod.children}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VikiBusinessChat;
