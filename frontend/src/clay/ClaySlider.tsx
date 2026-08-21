import { useState } from "react";

/**
 * A slider paired with an editable number field.
 *
 * The slider is for exploring; the field is for hitting an exact value like
 * 0.30, which dragging cannot do reliably and which matters when a result has
 * to be reproducible. While the user is typing, the field holds a local draft
 * string so partial input like "0." or "-" is not parsed and clobbered on every
 * keystroke; the draft commits on blur or Enter, clamped to the declared range,
 * and junk reverts to the last good value rather than reporting NaN.
 */
export function ClaySlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  help,
  disabled = false,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  help?: string;
  disabled?: boolean;
  format?: (value: number) => string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = format ? format(value) : String(Number(value.toFixed(4)));

  function commit(raw: string) {
    setDraft(null);
    const parsed = Number(raw);
    if (raw.trim() === "" || Number.isNaN(parsed)) return;
    onChange(Math.min(max, Math.max(min, parsed)));
  }

  return (
    // A plain div, not a <label>: a label may only be associated with one
    // control, and wrapping both the slider and the number field in one makes
    // each input's accessible name ambiguous. Each input carries its own
    // aria-label instead, and the visible text below is decorative.
    <div className="block mb-4" title={help}>
      <span className="flex items-baseline justify-between mb-1.5 gap-2">
        <span className="text-xs font-bold" style={{ color: "var(--clay-text)" }}>
          {label}
        </span>
        <input
          aria-label={`${label} value`}
          // Deliberately text rather than number: a number input silently
          // discards unparseable input, so typing junk would blank the field
          // with no feedback. As text, the bad value stays visible until it
          // reverts on blur. inputMode keeps the numeric keypad on mobile.
          type="text"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={draft ?? shown}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit((event.target as HTMLInputElement).value);
            }
          }}
          className="text-xs font-mono px-2 py-0.5 w-20 text-right"
          style={{
            color: "var(--clay-accent)",
            background: "var(--clay-surface-sunken)",
            border: "none",
            borderRadius: "8px",
            boxShadow: "var(--clay-shadow-sunken)",
          }}
        />
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full appearance-none h-3 cursor-pointer"
        style={{
          background: "var(--clay-surface-sunken)",
          borderRadius: "999px",
          boxShadow: "var(--clay-shadow-sunken)",
          accentColor: "var(--clay-accent)",
        }}
      />
      {help && (
        <span
          className="block text-[11px] mt-1 leading-snug"
          style={{ color: "var(--clay-text-faint)" }}
        >
          {help}
        </span>
      )}
    </div>
  );
}
