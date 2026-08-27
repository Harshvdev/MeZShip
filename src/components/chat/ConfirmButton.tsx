"use client";

import { useState, useEffect, useRef, useCallback, ReactNode } from "react";

interface ConfirmButtonProps {
  label: string;
  confirmLabel?: string;
  icon?: ReactNode;
  confirmIcon?: ReactNode;
  onAction: () => void;
  variant: "skip" | "leave";
  size?: "normal" | "compact";
  className?: string;
  title?: string;
  confirmTitle?: string;
  durationMs?: number;
  disabled?: boolean;
}

export function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  icon,
  confirmIcon,
  onAction,
  variant,
  size = "normal",
  className = "",
  title,
  confirmTitle,
  durationMs = 3000,
  disabled = false,
}: ConfirmButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  // Reset confirmation if button becomes disabled
  useEffect(() => {
    if (disabled && isConfirming) {
      clearTimer();
      setIsConfirming(false);
    }
  }, [disabled, isConfirming, clearTimer]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    if (isConfirming) {
      // Second click: execute action
      clearTimer();
      setIsConfirming(false);
      onAction();
    } else {
      // First click: activate confirmation countdown
      setIsConfirming(true);
      clearTimer();
      timerRef.current = setTimeout(() => {
        setIsConfirming(false);
        timerRef.current = null;
      }, durationMs);
    }
  };

  // Base styling depending on size
  const sizeClasses =
    size === "compact"
      ? "px-2.5 py-1.5 text-xs gap-1"
      : "px-3 sm:px-3.5 py-2 text-xs gap-1 sm:gap-1.5";

  // Variant styling: Normal vs Confirming
  let variantClasses = "";
  if (variant === "skip") {
    if (isConfirming) {
      // Confirming Skip: Alert/Amber warning color with black text
      variantClasses =
        "bg-alert hover:bg-amber-400 text-ink border border-alert/50 shadow-md shadow-alert/25 font-bold animate-fade-in";
    } else {
      // Normal Skip: Push-to-talk signal green button
      variantClasses = "btn-ptt font-bold shadow-sm";
    }
  } else {
    // variant === "leave"
    if (isConfirming) {
      // Confirming Leave: Red color with white text as requested
      variantClasses =
        "bg-red-600 hover:bg-red-500 border border-red-500 text-white font-semibold shadow-md shadow-red-600/30 animate-fade-in";
    } else {
      // Normal Leave: Subtle dark surface button
      variantClasses =
        "bg-surface hover:bg-surface-raised border border-line hover:border-line-bright text-ash hover:text-paper font-semibold";
    }
  }

  const activeTitle = isConfirming
    ? confirmTitle || `Click again to confirm ${label.toLowerCase()}`
    : title;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={activeTitle}
      className={`relative overflow-hidden rounded-lg font-display tracking-wide select-none flex items-center justify-center transition-all duration-150 active:scale-[0.97] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
    >
      {/* Icon */}
      {isConfirming ? confirmIcon || icon : icon}

      {/* Label */}
      <span>{isConfirming ? confirmLabel : label}</span>

      {/* Thin loading progress bar shown in confirming state */}
      {isConfirming && (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-black/30 overflow-hidden pointer-events-none">
          <div
            className={`h-full origin-left animate-countdown-bar ${
              variant === "leave" ? "bg-white" : "bg-ink"
            }`}
            style={{ animationDuration: `${durationMs}ms` }}
          />
        </div>
      )}
    </button>
  );
}
