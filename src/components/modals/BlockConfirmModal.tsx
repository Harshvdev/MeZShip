"use client";

import { UserX, X } from "lucide-react";

interface BlockConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmBlock: () => Promise<boolean>;
  targetDisplayName?: string;
}

export function BlockConfirmModal({
  isOpen,
  onClose,
  onConfirmBlock,
  targetDisplayName,
}: BlockConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirmBlock();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl bg-surface border border-line-bright p-5 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2 text-alert">
            <UserX className="w-4 h-4" />
            <h3 className="font-display font-bold text-paper text-sm sm:text-base">
              Block Signal Peer
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ash hover:text-paper hover:bg-surface-raised transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-3.5 text-xs text-ash space-y-2 font-body leading-relaxed">
          <p>
            Are you sure you want to block peer{" "}
            <span className="font-mono text-paper font-semibold">
              {targetDisplayName || "Connected Peer"}
            </span>
            ?
          </p>
          <p className="font-mono text-[11px] text-ash/80">
            This peer will be added to your permanent signal exclusion list. Current session will terminate immediately.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-line text-ash hover:text-paper text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded-lg bg-alert hover:bg-alert/90 text-ink font-display font-bold text-xs transition-colors shadow-sm"
          >
            Confirm Block
          </button>
        </div>
      </div>
    </div>
  );
}

