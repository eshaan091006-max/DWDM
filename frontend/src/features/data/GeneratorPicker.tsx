import { useEffect, useState } from "react";

import { ClayButton, ClaySelect, ClaySlider } from "../../clay";
import { api } from "../../lib/api";
import type { GeneratorSpec } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

export function GeneratorPicker() {
  const [generators, setGenerators] = useState<Record<string, GeneratorSpec>>({});
  const [kind, setKind] = useState("blobs");
  const [count, setCount] = useState(300);
  const [noise, setNoise] = useState(0.05);
  const [seed, setSeed] = useState(42);

  const setPoints = useAppStore((s) => s.setPoints);
  const setError = useAppStore((s) => s.setError);
  const setBusy = useAppStore((s) => s.setBusy);

  useEffect(() => {
    api.generators().then(setGenerators).catch(() => setGenerators({}));
  }, []);

  const active = generators[kind];

  async function build() {
    setBusy(true);
    try {
      const data = await api.generate({
        kind,
        n_samples: count,
        noise,
        random_seed: seed,
      });
      setPoints(data.points, data.feature_names, data.source_labels, active?.label ?? kind);
      setError(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ClaySelect
        label="Dataset"
        value={kind}
        onChange={setKind}
        options={Object.values(generators).map((g) => ({ value: g.key, label: g.label }))}
      />
      {active && (
        <p className="text-[11px] mb-4 leading-snug" style={{ color: "var(--clay-text-muted)" }}>
          {active.hint}
        </p>
      )}
      <ClaySlider label="Points" value={count} min={20} max={2000} step={10} onChange={setCount} />
      <ClaySlider
        label="Noise"
        value={noise}
        min={0}
        max={0.5}
        step={0.01}
        onChange={setNoise}
        disabled={active ? !active.supports_noise : false}
      />
      <ClaySlider label="Seed" value={seed} min={0} max={999} step={1} onChange={setSeed} />
      <ClayButton variant="primary" onClick={build}>
        Generate
      </ClayButton>
    </div>
  );
}
