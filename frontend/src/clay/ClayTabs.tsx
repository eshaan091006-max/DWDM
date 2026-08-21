export function ClayTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1.5 p-1.5"
      style={{
        background: "var(--clay-surface-sunken)",
        borderRadius: "var(--clay-radius)",
        boxShadow: "var(--clay-shadow-sunken)",
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className="flex-1 px-3 py-2 text-xs font-bold cursor-pointer"
            style={{
              background: selected ? "var(--clay-accent)" : "transparent",
              color: selected ? "var(--clay-accent-text)" : "var(--clay-text-muted)",
              border: "none",
              borderRadius: "var(--clay-radius-sm)",
              boxShadow: selected ? "var(--clay-shadow)" : "none",
              transition: "all var(--clay-fast) ease",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
