import { useState } from "react";

import { ClayBadge, ClayButton, ClayCard, ClayTabs } from "../../clay";
import { useAppStore } from "../../store/appStore";
import { FileImport } from "./FileImport";
import { GeneratorPicker } from "./GeneratorPicker";

const TABS = [
  { id: "generate", label: "Generate" },
  { id: "import", label: "Import" },
  { id: "draw", label: "Draw" },
];

export function DataPanel() {
  const [tab, setTab] = useState("generate");
  const points = useAppStore((s) => s.points);
  const featureNames = useAppStore((s) => s.featureNames);
  const datasetName = useAppStore((s) => s.datasetName);
  const clearPoints = useAppStore((s) => s.clearPoints);

  return (
    <ClayCard
      title="Data"
      subtitle={`${points.length} points · ${featureNames.length}D · ${datasetName}`}
    >
      <div className="mb-4">
        <ClayTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {tab === "generate" && <GeneratorPicker />}
      {tab === "import" && <FileImport />}
      {tab === "draw" && (
        <div>
          {featureNames.length === 2 ? (
            <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--clay-text-muted)" }}>
              Click empty canvas to add a point, drag a point to move it, and right-click
              (or alt-click) a point to delete it.
            </p>
          ) : (
            <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--clay-warn)" }}>
              Drawing is only available for 2D data. This dataset has {featureNames.length}{" "}
              features and the canvas shows a PCA projection, so a click there has no single
              meaning in the original space.
            </p>
          )}
          <ClayButton variant="danger" onClick={clearPoints} disabled={points.length === 0}>
            Clear all points
          </ClayButton>
        </div>
      )}

      {featureNames.length > 2 && (
        <p className="mt-4">
          <ClayBadge tone="accent">
            clustered in {featureNames.length}D · shown via PCA
          </ClayBadge>
        </p>
      )}
    </ClayCard>
  );
}
