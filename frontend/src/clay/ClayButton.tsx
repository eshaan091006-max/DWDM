import type { ReactNode } from "react";

import { useMagnetic } from "./useMagnetic";

const TONES = {
  primary: {
    background: "linear-gradient(140deg, var(--clay-accent), var(--clay-accent-2))",
    color: "var(--clay-accent-text)",
  },
  ghost: { background: "var(--clay-surface-raised)", color: "var(--clay-text)" },
  danger: { background: "linear-gradient(140deg, var(--clay-warn), #f0a48f)", color: "#fff" },
} as const;

export function ClayButton({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  disabled = false,
  active = false,
  title,
  type = "button",
  magnetic = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof TONES;
  size?: "sm" | "md";
  disabled?: boolean;
  active?: boolean;
  title?: string;
  type?: "button" | "submit";
  /** Leans toward the cursor on hover. Off inside tight control clusters. */
  magnetic?: boolean;
}) {
  const { ref, onMouseMove, onMouseLeave } = useMagnetic(size === "sm" ? 0.18 : 0.26, size === "sm" ? 4 : 7);
  const engage = magnetic && !disabled;

  return (
    <button
      ref={ref}
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseMove={engage ? onMouseMove : undefined}
      onMouseLeave={engage ? onMouseLeave : undefined}
      className={`font-bold tracking-tight select-none clay-3d-btn clay-magnetic ${
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
      } ${disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer"}`}
      style={{
        ...TONES[variant],
        borderRadius: "var(--clay-radius-sm)",
        border: "none",
        // Pressed state inverts the inner shadow pair so the surface reads as
        // pushed into the page rather than sitting on it.
        boxShadow: active ? "var(--clay-shadow-pressed)" : "var(--clay-shadow)",
      }}
    >
      {children}
    </button>
  );
}
