import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError, api } from "./api";

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("posts points and params to the right cluster URL", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ algorithm: "dbscan", labels: [0] }));

    await api.cluster("dbscan", {
      points: [[0, 0]],
      params: { eps: 0.5 },
      record_trace: true,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/cluster/dbscan");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      points: [[0, 0]],
      params: { eps: 0.5 },
      record_trace: true,
    });
  });

  it("unwraps the error envelope into ApiClientError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(
        { error: { code: "invalid_params", message: "eps must be greater than 0", field: "eps" } },
        422,
      ),
    );

    await expect(
      api.cluster("dbscan", { points: [[0, 0]], params: {}, record_trace: false }),
    ).rejects.toMatchObject({
      code: "invalid_params",
      message: "eps must be greater than 0",
      field: "eps",
    });
  });

  it("falls back to a readable message when the body is not an envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse("boom", 500));
    await expect(api.algorithms()).rejects.toBeInstanceOf(ApiClientError);
  });

  it("health returns false instead of throwing when the backend is down", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await api.health()).toBe(false);
  });

  it("reports an unreachable backend distinctly from a rejected request", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(api.algorithms()).rejects.toMatchObject({ code: "unreachable" });
  });

  it("unwraps the algorithms envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ algorithms: { dbscan: { key: "dbscan" } } }),
    );
    const result = await api.algorithms();
    expect(result.dbscan.key).toBe("dbscan");
  });

  it("unwraps the compare envelope to the results map", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ results: { dbscan: { algorithm: "dbscan" }, birch: {}, cure: {} } }),
    );
    const result = await api.compare({ points: [[0, 0]], configs: {} });
    expect(Object.keys(result)).toEqual(["dbscan", "birch", "cure"]);
  });

  it("uploads a file as multipart form data without setting Content-Type", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ columns: ["x"], rows: [], n_rows: 0 }));
    await api.upload(new File(["x\n1\n"], "d.csv", { type: "text/csv" }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/datasets/upload");
    expect(init?.body).toBeInstanceOf(FormData);
    // The browser must set the multipart boundary itself; sending our own
    // Content-Type would produce a boundary-less header the server can't parse.
    expect(init?.headers).toBeUndefined();
  });

  it("sends generator requests with all four parameters", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse({ points: [], feature_names: [], source_labels: [] }));
    await api.generate({ kind: "moons", n_samples: 120, noise: 0.05, random_seed: 0 });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      kind: "moons",
      n_samples: 120,
      noise: 0.05,
      random_seed: 0,
    });
  });
});
