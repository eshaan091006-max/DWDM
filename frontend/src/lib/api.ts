import type {
  AlgorithmKey,
  AlgorithmSpec,
  ClusterResponse,
  GeneratorSpec,
  ParsedTable,
} from "./types";

/** An error the backend described in its `{"error": {...}}` envelope. */
export class ApiClientError extends Error {
  code: string;
  field: string | null;

  constructor(message: string, code = "request_failed", field: string | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.field = field;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    // A network-level failure means the backend is not running at all, which is
    // a different problem from a rejected request and deserves its own message.
    throw new ApiClientError(
      "Cannot reach the backend. Is it running on port 8000?",
      "unreachable",
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const envelope = (body as { error?: { code: string; message: string; field: string | null } })
      ?.error;
    throw new ApiClientError(
      envelope?.message ?? `Request to ${url} failed with status ${response.status}.`,
      envelope?.code ?? "request_failed",
      envelope?.field ?? null,
    );
  }
  return body as T;
}

function postJson<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export const api = {
  /** Returns false rather than throwing: the header polls this every 10s. */
  async health(): Promise<boolean> {
    try {
      const body = await request<{ status: string }>("/api/health");
      return body.status === "ok";
    } catch {
      return false;
    }
  },

  async algorithms(): Promise<Record<AlgorithmKey, AlgorithmSpec>> {
    const body = await request<{ algorithms: Record<AlgorithmKey, AlgorithmSpec> }>(
      "/api/algorithms",
    );
    return body.algorithms;
  },

  async generators(): Promise<Record<string, GeneratorSpec>> {
    const body = await request<{ generators: Record<string, GeneratorSpec> }>(
      "/api/datasets/generators",
    );
    return body.generators;
  },

  generate(body: { kind: string; n_samples: number; noise: number; random_seed: number }) {
    return postJson<{ points: number[][]; feature_names: string[]; source_labels: number[] }>(
      "/api/datasets/generate",
      body,
    );
  },

  upload(file: File): Promise<ParsedTable> {
    const form = new FormData();
    form.append("file", file);
    // No Content-Type header: the browser must set the multipart boundary itself.
    return request<ParsedTable>("/api/datasets/upload", { method: "POST", body: form });
  },

  cluster(
    algorithm: AlgorithmKey,
    body: {
      points: number[][];
      params: Record<string, unknown>;
      record_trace: boolean;
      max_steps?: number;
      standardize?: boolean;
    },
  ): Promise<ClusterResponse> {
    return postJson<ClusterResponse>(`/api/cluster/${algorithm}`, body);
  },

  async compare(body: {
    points: number[][];
    configs: Record<string, Record<string, unknown>>;
    standardize?: boolean;
  }): Promise<Record<AlgorithmKey, ClusterResponse>> {
    const result = await postJson<{ results: Record<AlgorithmKey, ClusterResponse> }>(
      "/api/cluster/compare",
      body,
    );
    return result.results;
  },
};
