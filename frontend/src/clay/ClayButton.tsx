import type { ReactNode } from "react";

const TONES = {
  primary: { background: "var(--clay-accent)", color: "var(--clay-accent-text)" },
  ghost: { background: "var(--clay-surface-raised)", color: "var(--clay-text)" },
  danger: { background: "var(--clay-warn)", color: "#fff" },
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
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof TONES;
  size?: "sm" | "md";
  disabled?: boolean;
  active?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`font-bold tracking-tight select-none ${
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
      } ${disabled ? "opacity-45 cursor-not-allowed" : "cursor-pointer active:scale-[0.97]"}`}
      style={{
        ...TONES[variant],
        borderRadius: "var(--clay-radius-sm)",
        border: "none",
        // Pressed state inverts the inner shadow pair so the surface reads as
        // pushed into the page rather than sitting on it.
        boxShadow: active ? "var(--clay-shadow-pressed)" : "var(--clay-shadow)",
        transition: "transform var(--clay-fast) var(--clay-ease), box-shadow var(--clay-fast) ease",
      }}
    >
      {children}
    </button>
  );
}
