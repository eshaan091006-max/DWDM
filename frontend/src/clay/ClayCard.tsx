import type { ReactNode } from "react";

export function ClayCard({
  children,
  title,
  subtitle,
  tone = "raised",
  className = "",
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  tone?: "raised" | "sunken";
  className?: string;
}) {
  return (
    <section
      className={`p-5 ${className}`}
      style={{
        background: tone === "sunken" ? "var(--clay-surface-sunken)" : "var(--clay-surface)",
        borderRadius: "var(--clay-radius-lg)",
        boxShadow: tone === "sunken" ? "var(--clay-shadow-sunken)" : "var(--clay-shadow)",
      }}
    >
      {title && (
        <header className="mb-3">
          <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--clay-text)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--clay-text-muted)" }}>
              {subtitle}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
