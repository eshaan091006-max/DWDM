import { type SerialisedTree, layoutTree } from "./treeLayout";

const NODE_W = 96;
const NODE_H = 46;

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

  const layout = layoutTree(tree);
  const onPath = new Set(highlightPath);
  const splitting = new Set(splitNodes);
  const positions = new Map(layout.nodes.map((node) => [node.id, node]));

  return (
    <div className="w-full overflow-x-auto">
      <svg width={layout.width} height={layout.height} style={{ display: "block" }}>
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
                stroke: lit ? "var(--clay-accent)" : "var(--clay-text-faint)",
                strokeWidth: lit ? 2.5 : 1.2,
              }}
            />
          );
        })}

        {layout.nodes.map((node) => {
          const lit = onPath.has(node.id);
          const split = splitting.has(node.id);
          const fill = split
            ? "var(--clay-warn)"
            : lit
              ? "var(--clay-accent)"
              : "var(--clay-surface-raised)";
          const text = split || lit ? "#ffffff" : "var(--clay-text)";
          return (
            <g key={`node-${node.id}`}>
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx={14}
                style={{
                  fill,
                  stroke: node.is_leaf ? "var(--clay-good)" : "var(--clay-text-faint)",
                  strokeWidth: node.is_leaf ? 2 : 1,
                }}
              />
              <text
                x={node.x + NODE_W / 2}
                y={node.y + 19}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                style={{ fill: text }}
              >
                {node.is_leaf ? "leaf" : "internal"}
              </text>
              <text
                x={node.x + NODE_W / 2}
                y={node.y + 34}
                textAnchor="middle"
                fontSize={10}
                style={{ fill: text, opacity: 0.85 }}
              >
                {node.entryCount} entries · {node.pointCount} pts
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
