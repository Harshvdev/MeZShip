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
        setErrorMessage("Failed to submit report. Please try again.");
      }
    } catch {
      setErrorMessage("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl glass-panel border border-white/15 p-6 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="font-semibold text-white">Report User</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-xs text-gray-400">
            Why are you reporting{" "}
            <span className="text-white font-medium">
              {targetDisplayName || "this user"}
            </span>
            ? Reports contribute to automatic account suspensions.
          </p>

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Reason Radio Categories */}
          <div className="space-y-2">
            {Object.values(ReportReason).map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedReason === reason
                    ? "bg-amber-500/15 border-amber-500/50 text-white font-medium"
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-white/20"
                }`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                  className="accent-amber-500"
                />
                <span>{REPORT_REASON_LABELS[reason]}</span>
              </label>
            ))}
          </div>

          {/* Optional Details (Max 300 chars) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <label className="text-gray-300 font-medium">
                Details / Reason (Optional)
              </label>
              <span className="text-gray-500">{details.length}/300</span>
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Provide extra context if helpful..."
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 focus:border-amber-500 focus:outline-none text-xs text-white placeholder-gray-500 resize-none transition-colors"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
