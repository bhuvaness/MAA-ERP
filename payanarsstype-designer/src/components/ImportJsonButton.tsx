// ============================================================================
// ImportJsonButton.tsx
// ============================================================================
// Upload button placed next to the existing "Export JSON" button.
// Matches the same styling conventions used in PayanarssType Designer.
//
// USAGE:
//   <ImportJsonButton
//     selectedType={selectedPayanarssType}
//     existingRecords={currentChildRecords}
//     onImportComplete={handleRefresh}
//   />
// ============================================================================

import React, { useRef, useState } from "react";
import {
  handlePayanarssTypeImport,
  PayanarssType,
  ImportResult,
} from "./payanarssTypeImportUtils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportJsonButtonProps {
  /** The currently selected PayanarssType node in the tree */
  selectedType: PayanarssType | null;

  /** Existing child records under the selected node (for duplicate detection) */
  existingRecords: PayanarssType[];

  /** Callback fired after successful import — use to refresh the UI/tree */
  onImportComplete: (importedRecords: PayanarssType[]) => void;

  /** Optional: API function to save records to your backend */
  onSaveToBackend?: (records: PayanarssType[]) => Promise<void>;

  /** Optional: custom class for the button */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ImportJsonButton: React.FC<ImportJsonButtonProps> = ({
  selectedType,
  existingRecords,
  onImportComplete,
  onSaveToBackend,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ---- Handle button click: open file dialog ----
  const handleClick = () => {
    if (!selectedType) {
      alert("Please select a PayanarssType node first.");
      return;
    }
    // Trigger the hidden file input
    fileInputRef.current?.click();
  };

  // ---- Handle file selection ----
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedType) return;

    setIsProcessing(true);

    try {
      // Run the full import pipeline:
      // Parse → Validate → Regenerate Ids → Transform → Check Duplicates
      const result = await handlePayanarssTypeImport(
        file,
        selectedType.Id,
        existingRecords
      );

      setImportResult(result);

      if (result.success) {
        // ---- Save to backend if handler provided ----
        if (onSaveToBackend) {
          try {
            await onSaveToBackend(result.records);
          } catch (saveError: any) {
            setImportResult({
              ...result,
              success: false,
              errors: [
                `Import validated but save failed: ${saveError.message}`,
              ],
            });
            setShowResultModal(true);
            return;
          }
        }

        // Notify parent component to refresh
        onImportComplete(result.records);
      }

      // Show result modal (success or failure)
      setShowResultModal(true);
    } catch (error: any) {
      setImportResult({
        success: false,
        importedCount: 0,
        records: [],
        errors: [error.message || "An unexpected error occurred."],
        warnings: [],
      });
      setShowResultModal(true);
    } finally {
      setIsProcessing(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ---- Close the result modal ----
  const closeModal = () => {
    setShowResultModal(false);
    setImportResult(null);
  };

  return (
    <>
      {/* Hidden file input — accepts JSON only */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ================================================================
          UPLOAD BUTTON
          Styled to match the existing "Export JSON" button:
          - Same height, padding, border-radius
          - Orange/amber color to visually distinguish from Export (green)
          - Placed immediately next to Export JSON
          ================================================================ */}
      <button
        onClick={handleClick}
        disabled={isProcessing || !selectedType}
        className={className}
        style={{
          backgroundColor: isProcessing ? "#9CA3AF" : "#F59E0B",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "6px",
          padding: "8px 20px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: isProcessing ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          transition: "background-color 0.2s ease",
          opacity: !selectedType ? 0.5 : 1,
          marginLeft: "8px", // Space from Export JSON button
        }}
        onMouseEnter={(e) => {
          if (!isProcessing && selectedType) {
            (e.target as HTMLElement).style.backgroundColor = "#D97706";
          }
        }}
        onMouseLeave={(e) => {
          if (!isProcessing && selectedType) {
            (e.target as HTMLElement).style.backgroundColor = "#F59E0B";
          }
        }}
        title={
          !selectedType
            ? "Select a node first"
            : "Import PayanarssType JSON file"
        }
      >
        {/* Upload icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>

        {isProcessing ? "Importing..." : "Import JSON"}
      </button>

      {/* ================================================================
          RESULT MODAL
          Shows import success/failure with details
          ================================================================ */}
      {showResultModal && importResult && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              padding: "28px",
              maxWidth: "520px",
              width: "90%",
              maxHeight: "70vh",
              overflow: "auto",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  backgroundColor: importResult.success
                    ? "#D1FAE5"
                    : "#FEE2E2",
                }}
              >
                {importResult.success ? "✓" : "✕"}
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 700,
                    color: importResult.success ? "#065F46" : "#991B1B",
                  }}
                >
                  {importResult.success ? "Import Successful" : "Import Failed"}
                </h3>
                {importResult.success && (
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: "14px",
                      color: "#6B7280",
                    }}
                  >
                    {importResult.importedCount} record(s) imported
                  </p>
                )}
              </div>
            </div>

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div
                style={{
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "8px",
                  padding: "14px",
                  marginBottom: "12px",
                }}
              >
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#991B1B",
                    margin: "0 0 8px",
                  }}
                >
                  Errors:
                </p>
                {importResult.errors.map((error, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: "13px",
                      color: "#DC2626",
                      margin: "4px 0",
                      lineHeight: "1.4",
                    }}
                  >
                    • {error}
                  </p>
                ))}
              </div>
            )}

            {/* Warnings */}
            {importResult.warnings.length > 0 && (
              <div
                style={{
                  backgroundColor: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "8px",
                  padding: "14px",
                  marginBottom: "12px",
                }}
              >
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#92400E",
                    margin: "0 0 8px",
                  }}
                >
                  Warnings:
                </p>
                {importResult.warnings.map((warning, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: "13px",
                      color: "#B45309",
                      margin: "4px 0",
                      lineHeight: "1.4",
                    }}
                  >
                    ⚠ {warning}
                  </p>
                ))}
              </div>
            )}

            {/* Close button */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "20px",
              }}
            >
              <button
                onClick={closeModal}
                style={{
                  backgroundColor: "#3B82F6",
                  color: "#FFF",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 24px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportJsonButton;
