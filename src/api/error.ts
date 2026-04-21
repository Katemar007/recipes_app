export class ApiError extends Error {
  status: number;
  bodyText: string;

  constructor(message: string, status: number, bodyText: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

function formatDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "msg" in item) {
        const msg = (item as { msg?: unknown }).msg;
        if (typeof msg === "string") return msg;
      }
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    });
    return parts.filter(Boolean).join("\n");
  }
  return null;
}

function normalizeMessage(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "Request failed.";
  try {
    const parsed = JSON.parse(trimmed) as { detail?: unknown; message?: unknown };
    const fromDetail = formatDetail(parsed.detail);
    const message = typeof parsed.message === "string" ? parsed.message : null;
    return fromDetail ?? message ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function makeApiError(status: number, bodyText: string): ApiError {
  const base = normalizeMessage(bodyText);
  const message = base || `HTTP ${status}`;
  return new ApiError(message, status, bodyText);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiError) {
    const m = error.message.trim();
    return m || fallback;
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}
