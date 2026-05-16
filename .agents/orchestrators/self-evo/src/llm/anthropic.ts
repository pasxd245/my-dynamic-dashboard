import type {
  LLMCapabilities,
  LLMClient,
  LLMRequest,
  LLMResponse,
} from "./client.js";

export interface AnthropicClientOptions {
  apiKey?: string;
  model?: string;
  /** Default per-call max output tokens. */
  maxTokens?: number;
  capabilities?: LLMCapabilities;
  /** Hook for tests — override the SDK factory. */
  sdkFactory?: () => Promise<AnthropicSdkLike>;
}

// Minimal structural subset of the Anthropic SDK we use, so the rest of
// the codebase can type-check without forcing `@anthropic-ai/sdk` to be
// installed everywhere R-B lands.
export interface AnthropicSdkLike {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    }): Promise<{
      content: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    }>;
  };
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;

async function defaultSdkFactory(apiKey?: string): Promise<AnthropicSdkLike> {
  const mod = await import("@anthropic-ai/sdk");
  // @ts-ignore — runtime import; the SDK is an optional dep.
  const Anthropic = mod.default ?? mod.Anthropic;
  return new Anthropic({ apiKey }) as AnthropicSdkLike;
}

export function makeAnthropicClient(
  opts: AnthropicClientOptions = {},
): LLMClient {
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const capabilities = opts.capabilities ?? {
    supportsParallel: true,
    maxConcurrency: 4,
  };
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;

  let sdkPromise: Promise<AnthropicSdkLike> | undefined;
  const sdk = () => {
    if (!sdkPromise) {
      sdkPromise = (opts.sdkFactory ?? (() => defaultSdkFactory(apiKey)))();
    }
    return sdkPromise;
  };

  return {
    mode: "api",
    capabilities,
    async complete(req: LLMRequest): Promise<LLMResponse> {
      const client = await sdk();
      const res = await client.messages.create({
        model: req.model ?? model,
        max_tokens: req.maxTokens ?? maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
      });
      const text = res.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim();
      return {
        text,
        usage: {
          inputTokens: res.usage?.input_tokens,
          outputTokens: res.usage?.output_tokens,
        },
      };
    },
  };
}
