import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { AlgorithmSpec } from "../../lib/types";
import { useAppStore } from "../../store/appStore";
import { ParamPanel } from "./ParamPanel";

const emptyTheory = {
  summary: "",
  how_it_works: [],
  parameters: {},
  complexity: "",
  strengths: [],
  weaknesses: [],
};

const specs = {
  dbscan: {
    key: "dbscan",
    label: "DBSCAN",
    tagline: "",
    params: [
      {
        name: "eps",
        label: "eps",
        type: "float",
        default: 0.5,
        min: 0.01,
        max: 5,
        step: 0.01,
        help: "radius",
      },
      {
        name: "min_pts",
        label: "minPts",
        type: "int",
        default: 5,
        min: 1,
        max: 50,
        step: 1,
        help: "count",
      },
      {
        name: "metric",
        label: "Metric",
        type: "choice",
        default: "euclidean",
        options: ["euclidean", "manhattan"],
        help: "distance",
      },
    ],
    theory: emptyTheory,
  },
  birch: {
    key: "birch",
    label: "BIRCH",
    tagline: "",
    params: [
      {
        name: "n_clusters",
        label: "clusters",
        type: "int",
        default: null,
        min: 1,
        max: 20,
        step: 1,
        help: "optional",
      },
    ],
    theory: emptyTheory,
  },
  cure: { key: "cure", label: "CURE", tagline: "", params: [], theory: emptyTheory },
} as unknown as Record<"dbscan" | "birch" | "cure", AlgorithmSpec>;

beforeEach(() => {
  useAppStore.getState().setSpecs(specs);
});

describe("ParamPanel", () => {
  it("renders a control for every declared parameter", () => {
    render(<ParamPanel algorithm="dbscan" />);
    expect(screen.getByLabelText("eps")).toBeDefined();
    expect(screen.getByLabelText("minPts")).toBeDefined();
    expect(screen.getByLabelText("Metric")).toBeDefined();
  });

  it("seeds controls from the declared defaults", () => {
    render(<ParamPanel algorithm="dbscan" />);
    expect((screen.getByLabelText("eps") as HTMLInputElement).value).toBe("0.5");
  });

  it("writes slider changes into the store", () => {
    render(<ParamPanel algorithm="dbscan" />);
    fireEvent.change(screen.getByLabelText("eps"), { target: { value: "1.25" } });
    expect(useAppStore.getState().params.dbscan.eps).toBe(1.25);
  });

  it("writes an exact typed value into the store", () => {
    render(<ParamPanel algorithm="dbscan" />);
    const field = screen.getByLabelText("eps value");
    fireEvent.change(field, { target: { value: "0.3" } });
    fireEvent.blur(field);
    expect(useAppStore.getState().params.dbscan.eps).toBe(0.3);
  });

  it("writes choice changes into the store", () => {
    render(<ParamPanel algorithm="dbscan" />);
    fireEvent.change(screen.getByLabelText("Metric"), { target: { value: "manhattan" } });
    expect(useAppStore.getState().params.dbscan.metric).toBe("manhattan");
  });

  it("renders an optional parameter as an off toggle", () => {
    render(<ParamPanel algorithm="birch" />);
    expect((screen.getByLabelText("Set clusters") as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByLabelText("clusters")).toBeNull();
  });

  it("enabling an optional parameter gives it a non-degenerate value", () => {
    render(<ParamPanel algorithm="birch" />);
    fireEvent.click(screen.getByLabelText("Set clusters"));
    expect(useAppStore.getState().params.birch.n_clusters).toBe(3);
    expect(screen.getByLabelText("clusters")).toBeDefined();
  });

  it("disabling an optional parameter clears it back to null", () => {
    render(<ParamPanel algorithm="birch" />);
    fireEvent.click(screen.getByLabelText("Set clusters"));
    fireEvent.click(screen.getByLabelText("Set clusters"));
    expect(useAppStore.getState().params.birch.n_clusters).toBeNull();
  });

  it("says so when the algorithm has no parameters", () => {
    render(<ParamPanel algorithm="cure" />);
    expect(screen.getByText(/no parameters/i)).toBeDefined();
  });
});
