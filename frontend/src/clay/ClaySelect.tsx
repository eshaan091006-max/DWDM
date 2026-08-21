export function ClaySelect({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  help?: string;
}) {
  return (
    <label className="block mb-4" title={help}>
      <span className="block text-xs font-bold mb-1.5" style={{ color: "var(--clay-text)" }}>
        {label}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2.5 text-sm cursor-pointer"
        style={{
          background: "var(--clay-surface-raised)",
          color: "var(--clay-text)",
          border: "none",
          borderRadius: "var(--clay-radius-sm)",
          boxShadow: "var(--clay-shadow)",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help && (
        <span className="block text-[11px] mt-1" style={{ color: "var(--clay-text-faint)" }}>
          {help}
        </span>
      )}
    </label>
  );
}
