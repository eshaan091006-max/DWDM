export interface SerialisedEntry {
  n: number;
  centroid: number[];
  radius: number;
  child: number | null;
}
export interface SerialisedNode {
  id: number;
  parent: number | null;
  is_leaf: boolean;
  entries: SerialisedEntry[];
}
export interface SerialisedTree {
  root: number;
  nodes: SerialisedNode[];
}

export interface LaidOutNode {
  id: number;
  parent: number | null;
  is_leaf: boolean;
  entryCount: number;
  pointCount: number;
  depth: number;
  x: number;
  y: number;
}

export interface TreeLayout {
  nodes: LaidOutNode[];
  width: number;
  height: number;
}

/**
 * A two-pass tidy layout: leaves take successive x slots in a depth-first walk,
 * then each internal node centres itself over its children.
 *
 * BIRCH trees are shallow and narrow, so this is enough — a full
 * Reingold-Tilford pass would buy nothing here.
 */
export function layoutTree(
  tree: SerialisedTree,
  nodeWidth = 132,
  levelHeight = 96,
): TreeLayout {
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  if (byId.size === 0 || !byId.has(tree.root)) {
    return { nodes: [], width: nodeWidth, height: levelHeight };
  }

  const laid = new Map<number, LaidOutNode>();
  let nextLeafSlot = 0;
  // A malformed tree (a cycle, or a child id that does not exist) must not send
  // this into an infinite descent.
  const seen = new Set<number>();

  const walk = (id: number, depth: number): number => {
    const node = byId.get(id);
    if (!node || seen.has(id)) return nextLeafSlot * nodeWidth;
    seen.add(id);

    const childIds = node.entries
      .map((entry) => entry.child)
      .filter((child): child is number => child !== null && byId.has(child));

    let x: number;
    if (childIds.length === 0) {
      x = nextLeafSlot * nodeWidth;
      nextLeafSlot += 1;
    } else {
      const childXs = childIds.map((childId) => walk(childId, depth + 1));
      x = childXs.reduce((sum, value) => sum + value, 0) / childXs.length;
    }

    laid.set(id, {
      id: node.id,
      parent: node.parent,
      is_leaf: node.is_leaf,
      entryCount: node.entries.length,
      pointCount: node.entries.reduce((sum, entry) => sum + entry.n, 0),
      depth,
      x,
      y: depth * levelHeight,
    });
    return x;
  };

  walk(tree.root, 0);

  const nodes = [...laid.values()];
  const maxX = Math.max(nodeWidth, ...nodes.map((node) => node.x));
  const maxY = Math.max(levelHeight, ...nodes.map((node) => node.y));
  return { nodes, width: maxX + nodeWidth, height: maxY + levelHeight };
}
