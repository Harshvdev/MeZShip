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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl glass-panel border border-white/15 p-6 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-rose-400">
            <UserX className="w-5 h-5" />
            <h3 className="font-semibold text-white">Block User</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 text-xs text-gray-300 space-y-2">
          <p>
            Are you sure you want to block{" "}
            <span className="text-white font-medium">
              {targetDisplayName || "this user"}
            </span>
            ?
          </p>
          <p className="text-gray-400">
            You will not be matched with each other in future chats. Your current session will end immediately.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors shadow-lg shadow-rose-600/30"
          >
            Block & Skip
          </button>
        </div>
      </div>
    </div>
  );
}
