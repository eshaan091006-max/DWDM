import { ClaySelect, ClaySlider, ClayToggle } from "../../clay";
import type { AlgorithmKey, ParamSpec } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

/** Optional numeric parameters declare a null default and may be left unset. */
function isOptional(spec: ParamSpec): boolean {
  return spec.default === null && (spec.type === "int" || spec.type === "float");
}

export function ParamPanel({ algorithm }: { algorithm: AlgorithmKey }) {
  const specs = useAppStore((state) => state.specs);
  const params = useAppStore((state) => state.params[algorithm]);
  const setParam = useAppStore((state) => state.setParam);

  const spec = specs?.[algorithm];
  if (!spec) {
    return (
      <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
        Loading parameters…
      </p>
    );
  }
  if (spec.params.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
        This algorithm has no parameters.
      </p>
    );
  }

  return (
    <div>
      {spec.params.map((param) => {
        const value = params?.[param.name] ?? param.default;

        if (param.type === "choice") {
          return (
            <ClaySelect
              key={param.name}
              label={param.label}
              help={param.help}
              value={String(value ?? param.options?.[0] ?? "")}
              options={(param.options ?? []).map((option) => ({ value: option, label: option }))}
              onChange={(next) => setParam(algorithm, param.name, next)}
            />
          );
        }

        if (isOptional(param)) {
          const enabled = value !== null && value !== undefined;
          return (
            <div key={param.name}>
              <ClayToggle
                label={`Set ${param.label}`}
                help={param.help}
                checked={enabled}
                // Enabling picks a value just above the minimum rather than the
                // minimum itself, which is usually a degenerate choice (k=1).
                onChange={(on) => setParam(algorithm, param.name, on ? (param.min ?? 1) + 2 : null)}
              />
              {enabled && (
                <ClaySlider
                  label={param.label}
                  help={param.help}
                  value={Number(value)}
                  min={param.min ?? 0}
                  max={param.max ?? 100}
                  step={param.step ?? 1}
                  onChange={(next) => setParam(algorithm, param.name, next)}
                />
              )}
            </div>
          );
        }

        return (
          <ClaySlider
            key={param.name}
            label={param.label}
            help={param.help}
            value={Number(value ?? 0)}
            min={param.min ?? 0}
            max={param.max ?? 100}
            step={param.step ?? 1}
            onChange={(next) => setParam(algorithm, param.name, next)}
          />
        );
      })}
    </div>
  );
}
