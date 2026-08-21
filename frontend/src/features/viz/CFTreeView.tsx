import { type SerialisedTree, layoutTree } from "./treeLayout";

/**
 * Node box. Wide enough for the longest label it can hold ("999 entries"), so
 * text is never centred wider than its own box — which previously pushed the
 * leading characters off the left edge of the SVG where they were clipped away.
 */
const NODE_W = 124;
const NODE_H = 58;
/** Slot pitch used by the layout; the gap between boxes is PITCH - NODE_W. */
const PITCH = 140;
/** Breathing room so the leftmost box and its border are never clipped. */
const PAD = 8;

export function CFTreeView({
  tree,
  highlightPath = [],
  splitNodes = [],
}: {
  tree: SerialisedTree | null;
  highlightPath?: number[];
  splitNodes?: number[];
}) {
  if (!tree || tree.nodes.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--clay-text-faint)" }}>
        The CF-tree appears here once BIRCH has run.
      </p>
    );
  }

  const layout = layoutTree(tree, PITCH, 96);
  const onPath = new Set(highlightPath);
  const splitting = new Set(splitNodes);
  const positions = new Map(layout.nodes.map((node) => [node.id, node]));

  // Fit the viewport to the content rather than to the layout's own bounding
  // box, which reserves a full extra level of height below the deepest node.
  const maxX = Math.max(...layout.nodes.map((n) => n.x));
  const maxY = Math.max(...layout.nodes.map((n) => n.y));
  const width = maxX + NODE_W + PAD * 2;
  const height = maxY + NODE_H + PAD * 2;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} style={{ display: "block" }}>
        <g transform={`translate(${PAD}, ${PAD})`}>
          {layout.nodes.map((node) => {
            const parent = node.parent === null ? null : positions.get(node.parent);
            if (!parent) return null;
            const lit = onPath.has(node.id) && onPath.has(parent.id);
            return (
              <line
                key={`edge-${node.id}`}
                x1={parent.x + NODE_W / 2}
                y1={parent.y + NODE_H}
                x2={node.x + NODE_W / 2}
                y2={node.y}
                // Themed colours go through `style`, not the presentation
                // attribute: var() support in SVG attributes is uneven, and a
                // silent failure here renders an invisible tree.
                style={{
                  stroke: lit ? "var(--clay-accent)" : "var(--clay-text)",
                  strokeWidth: lit ? 3 : 2,
                }}
              />
            );
          })}

          {layout.nodes.map((node) => {
            const lit = onPath.has(node.id);
            const split = splitting.has(node.id);
            const fill = split
              ? "var(--clay-accent)"
              : lit
                ? "var(--clay-accent-soft)"
                : "var(--clay-surface-raised)";
            const ink = split ? "var(--clay-accent-text)" : "var(--clay-text)";
            return (
              <g key={`node-${node.id}`}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_W}
                  height={NODE_H}
                  // Square: this world has no rounded corners.
                  rx={0}
                  style={{
                    fill,
                    stroke: "var(--clay-text)",
                    strokeWidth: node.is_leaf ? 3 : 2,
                  }}
                />
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={800}
                  style={{ fill: ink, letterSpacing: "0.08em" }}
                >
                  {node.is_leaf ? "LEAF" : "INTERNAL"}
                </text>
                {/* Two short lines rather than one long one: the label now fits
                    inside its own box at every node width. */}
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + 34}
                  textAnchor="middle"
                  fontSize={10}
                  style={{ fill: ink }}
                >
                  {node.entryCount} {node.entryCount === 1 ? "entry" : "entries"}
                </text>
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + 48}
                  textAnchor="middle"
                  fontSize={10}
                  style={{ fill: ink, opacity: 0.75 }}
                >
                  {node.pointCount} pts
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
