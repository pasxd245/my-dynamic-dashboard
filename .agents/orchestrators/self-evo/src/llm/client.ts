export interface LLMRequest {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  /** Optional opaque tag used by drivers for tracing / logging. */
  tag?: string;
}

export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface LLMResponse {
  text: string;
  usage?: LLMUsage;
}

export interface LLMCapabilities {
  /** True when complete() calls can safely run concurrently. */
  supportsParallel: boolean;
  /** Soft upper bound for concurrent in-flight requests. */
  maxConcurrency: number;
}

export interface LLMClient {
  readonly mode: "subprocess" | "api";
  readonly capabilities: LLMCapabilities;
  complete(req: LLMRequest): Promise<LLMResponse>;
}
