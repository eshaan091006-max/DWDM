export function ClayToggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  return (
    <label className="flex items-center gap-2 mb-3 cursor-pointer whitespace-nowrap" title={help}>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        className="relative inline-block w-11 h-6 shrink-0"
        style={{
          background: checked ? "var(--clay-accent)" : "var(--clay-surface-sunken)",
          borderRadius: 0,
          boxShadow: "var(--clay-shadow-sunken)",
          transition: "background var(--clay-fast) ease",
        }}
      >
        <span
          className="absolute top-1 w-4 h-4"
          style={{
            left: checked ? "26px" : "4px",
            background: "var(--clay-surface-raised)",
            borderRadius: 0,
            boxShadow: "0 2px 5px var(--clay-drop)",
            transition: "left var(--clay-fast) var(--clay-ease)",
          }}
        />
      </span>
      <span className="text-xs font-bold" style={{ color: "var(--clay-text)" }}>
        {label}
      </span>
    </label>
  );
}
