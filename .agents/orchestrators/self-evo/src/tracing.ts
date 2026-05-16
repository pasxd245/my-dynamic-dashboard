// R-K: thin shim over LangGraph's invoke config so every self-evo
// thread is tagged consistently. LangChain core auto-exports spans to
// LangSmith when `LANGCHAIN_TRACING_V2=true` is set; the per-invoke
// `runName`, `tags`, and `metadata` we add here are what makes those
// spans findable.
//
// Env vars consumed by LangChain core (we set none of them — they're
// listed here so the README has a single referenceable line):
//   - LANGCHAIN_TRACING_V2     true | false (opt-in)
//   - LANGCHAIN_API_KEY        LangSmith key
//   - LANGCHAIN_ENDPOINT       optional override (self-hosted)
//   - LANGCHAIN_PROJECT        project name (free-form)

export interface TraceableInvokeConfig {
  configurable: { thread_id: string };
  runName: string;
  tags: string[];
  metadata: { runId: string; orchestrator: "self-evo" };
}

export function traceableInvokeConfig(runId: string): TraceableInvokeConfig {
  return {
    configurable: { thread_id: runId },
    runName: `self-evo:${runId}`,
    tags: ["self-evo", `run:${runId}`],
    metadata: { runId, orchestrator: "self-evo" },
  };
}

export function tracingEnabled(): boolean {
  const v = process.env.LANGCHAIN_TRACING_V2;
  return v === "true" || v === "1";
}
