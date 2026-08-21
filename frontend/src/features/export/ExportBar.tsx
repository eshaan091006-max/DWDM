import { ClayButton } from "../../clay";
import { downloadCanvasPng, downloadText, toLabelledCsv, toRunReport } from "../../lib/export";
import type { ClusterResponse } from "../../lib/types";
import { useAppStore } from "../../store/appStore";

export function ExportBar({
  result,
  canvasRef,
}: {
  result: ClusterResponse | null;
  /**
   * The canvas this bar exports.
   *
   * Required, and deliberately not optional: the deck mounts three plots at
   * once, so reaching for `document.querySelector("canvas")` would always grab
   * the first one in DOM order and silently export DBSCAN's plot under a
   * filename claiming BIRCH or CURE.
   */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const points = useAppStore((s) => s.points);
  const featureNames = useAppStore((s) => s.featureNames);
  const datasetName = useAppStore((s) => s.datasetName);
  const setError = useAppStore((s) => s.setError);
  const disabled = result === null;

  return (
    <div className="flex flex-wrap gap-2">
      <ClayButton
        size="sm"
        disabled={disabled}
        onClick={() =>
          result &&
          downloadText(
            `${datasetName}-${result.algorithm}-labels.csv`,
            toLabelledCsv(points, featureNames, result.labels),
            "text/csv",
          )
        }
      >
        Export CSV
      </ClayButton>

      <ClayButton
        size="sm"
        disabled={disabled}
        onClick={() => {
          const canvas = canvasRef.current;
          if (!canvas || !result) {
            setError("No plot to export yet.");
            return;
          }
          downloadCanvasPng(canvas, `${datasetName}-${result.algorithm}.png`);
        }}
      >
        Export PNG
      </ClayButton>

      <ClayButton
        size="sm"
        disabled={disabled}
        onClick={() =>
          result &&
          downloadText(
            `${datasetName}-${result.algorithm}-report.json`,
            toRunReport(result, datasetName, points.length),
            "application/json",
          )
        }
      >
        Export report
      </ClayButton>
    </div>
  );
}
