import type { ActionableError } from "./types";

export class ApiRequestError extends Error {
  actionableError?: ActionableError;

  constructor(message: string, actionableError?: ActionableError) {
    super(message);
    this.name = "ApiRequestError";
    this.actionableError = actionableError;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isActionableErrorPayload(value: unknown): value is ActionableError {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.error_code === "string" &&
    typeof value.stage === "string" &&
    typeof value.user_message === "string" &&
    Array.isArray(value.next_steps) &&
    typeof value.correlation_id === "string" &&
    typeof value.occurred_at_utc === "string"
  );
}

export async function throwApiRequestError(
  response: Response,
  fallbackMessage: string,
): Promise<never> {
  const text = await response.text();

  if (text) {
    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new ApiRequestError(text);
    }

    if (isActionableErrorPayload(payload)) {
      throw new ApiRequestError(payload.user_message, payload);
    }
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
      throw new ApiRequestError(payload.error.message);
    }

    throw new ApiRequestError(text);
  }

  throw new ApiRequestError(fallbackMessage);
}

export function getActionableError(error: unknown): ActionableError | null {
  if (error instanceof ApiRequestError) {
    return error.actionableError ?? null;
  }
  return null;
}

export function humanizeActionableStage(stage: ActionableError["stage"]): string {
  switch (stage) {
    case "upload_source":
      return "Upload + Source";
    case "schema_sheet":
      return "Schema + Sheet";
    case "results_saved":
      return "Results + Saved";
    case "query":
      return "Query";
    default:
      return "Global";
  }
}
