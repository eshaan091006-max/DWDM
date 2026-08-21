import { describe, expect, it } from "vitest";

import { layoutTree } from "./treeLayout";

const leafOnly = {
  root: 0,
  nodes: [
    {
      id: 0,
      parent: null,
      is_leaf: true,
      entries: [{ n: 5, centroid: [0, 0], radius: 0.1, child: null }],
    },
  ],
};

const twoLevels = {
  root: 0,
  nodes: [
    {
      id: 0,
      parent: null,
      is_leaf: false,
      entries: [
        { n: 5, centroid: [0, 0], radius: 0.3, child: 1 },
        { n: 7, centroid: [2, 2], radius: 0.4, child: 2 },
      ],
    },
    {
      id: 1,
      parent: 0,
      is_leaf: true,
      entries: [{ n: 5, centroid: [0, 0], radius: 0.3, child: null }],
    },
    {
      id: 2,
      parent: 0,
      is_leaf: true,
      entries: [
        { n: 4, centroid: [2, 2], radius: 0.2, child: null },
        { n: 3, centroid: [3, 3], radius: 0.2, child: null },
      ],
    },
  ],
};

describe("layoutTree", () => {
  it("lays out a single leaf at depth zero", () => {
    const layout = layoutTree(leafOnly);
    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0].depth).toBe(0);
    expect(layout.nodes[0].entryCount).toBe(1);
    expect(layout.nodes[0].pointCount).toBe(5);
  });

  it("puts children one level below their parent", () => {
    const layout = layoutTree(twoLevels);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    expect(byId.get(0)!.depth).toBe(0);
    expect(byId.get(1)!.depth).toBe(1);
    expect(byId.get(2)!.depth).toBe(1);
    expect(byId.get(0)!.y).toBeLessThan(byId.get(1)!.y);
  });

  it("gives sibling leaves distinct x positions", () => {
    const layout = layoutTree(twoLevels);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    expect(byId.get(1)!.x).not.toBeCloseTo(byId.get(2)!.x, 3);
  });

  it("centres a parent over its children", () => {
    const layout = layoutTree(twoLevels);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const midpoint = (byId.get(1)!.x + byId.get(2)!.x) / 2;
    expect(byId.get(0)!.x).toBeCloseTo(midpoint, 3);
  });

  it("sums point counts and entry counts per node", () => {
    const layout = layoutTree(twoLevels);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    expect(byId.get(2)!.pointCount).toBe(7);
    expect(byId.get(2)!.entryCount).toBe(2);
  });

  it("reports a bounding box that contains every node", () => {
    const layout = layoutTree(twoLevels);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(layout.width);
      expect(node.y).toBeLessThanOrEqual(layout.height);
    }
  });

  it("returns an empty layout for a tree with no nodes", () => {
    const layout = layoutTree({ root: 0, nodes: [] });
    expect(layout.nodes).toEqual([]);
    expect(layout.width).toBeGreaterThan(0);
  });

  it("does not loop forever on a tree with a missing child", () => {
    const broken = {
      root: 0,
      nodes: [
        {
          id: 0,
          parent: null,
          is_leaf: false,
          entries: [{ n: 1, centroid: [0, 0], radius: 0, child: 99 }],
        },
      ],
    };
    expect(() => layoutTree(broken)).not.toThrow();
  });

  it("does not loop forever on a cyclic tree", () => {
    const cyclic = {
      root: 0,
      nodes: [
        {
          id: 0,
          parent: null,
          is_leaf: false,
          entries: [{ n: 1, centroid: [0, 0], radius: 0, child: 1 }],
        },
        {
          id: 1,
          parent: 0,
          is_leaf: false,
          entries: [{ n: 1, centroid: [0, 0], radius: 0, child: 0 }],
        },
      ],
    };
    expect(() => layoutTree(cyclic)).not.toThrow();
  });
});
