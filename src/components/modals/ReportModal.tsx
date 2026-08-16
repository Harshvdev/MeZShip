"use client";

import { useState } from "react";
import { ReportReason, REPORT_REASON_LABELS } from "@/lib/protocol";
import { ShieldAlert, X, AlertCircle } from "lucide-react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitReport: (reason: ReportReason, details?: string) => Promise<boolean>;
  targetDisplayName?: string;
}

export function ReportModal({
  isOpen,
  onClose,
  onSubmitReport,
  targetDisplayName,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason>(
    ReportReason.HARASSMENT
  );
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const success = await onSubmitReport(selectedReason, details);
      if (success) {
        onClose();
      } else {
        setErrorMessage("Failed to submit safety report. Please try again.");
      }
    } catch {
      setErrorMessage("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-line-bright p-5 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2 text-alert">
            <ShieldAlert className="w-4 h-4" />
            <h3 className="font-display font-bold text-paper text-sm sm:text-base">
              Safety Incident Report
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ash hover:text-paper hover:bg-surface-raised transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
          <p className="text-xs text-ash leading-relaxed font-body">
            Flagging safety incident for peer{" "}
            <span className="text-paper font-mono font-semibold">
              {targetDisplayName || "Connected Peer"}
            </span>
            . Distinct reports trigger automated signal suspension.
          </p>

          {errorMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-alert/10 border border-alert/20 text-alert text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Reason Radio Categories */}
          <div className="space-y-1.5">
            {Object.values(ReportReason).map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                  selectedReason === reason
                    ? "bg-alert/15 border-alert/40 text-paper font-medium"
                    : "bg-surface-raised border-line text-ash hover:border-line-bright hover:text-paper"
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                  className="accent-alert"
                />
                <span className="font-mono text-xs">{REPORT_REASON_LABELS[reason]}</span>
              </label>
            ))}
          </div>

          {/* Optional Details (Max 300 chars) */}
          <div>
            <div className="flex items-center justify-between mb-1 font-mono text-[11px]">
              <label className="text-ash">Incident Context (Optional)</label>
              <span className="text-ash/60">{details.length}/300</span>
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Incident details or reason..."
              className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-line focus:border-alert focus:outline-none text-xs text-paper placeholder-ash/50 resize-none transition-colors"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-line text-ash hover:text-paper text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-alert hover:bg-alert/90 text-ink font-display font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? "Transmitting..." : "Submit Incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

