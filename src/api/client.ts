/**
 * HTTP entrypoint for the backend API.
 *
 * Rules:
 * - Use `apiFetch` for JSON under `API_BASE_URL` (paths like `/recipes`).
 * - Use `fetchWithApiAuth` only for full URLs or non-JSON bodies; always follow
 *   with `ensureApiOk` so failures become `ApiError` like `apiFetch`.
 * - Do not call `fetch` against the API from feature code — extend this module instead.
 */

import { API_BASE_URL } from "@/config/env";
import { getApiBasicAuthorizationHeader } from "./basicAuth";
import { makeApiError } from "./error";

type FetchOptions = RequestInit & { json?: unknown };

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { json, headers, ...rest } = options;
  const auth = getApiBasicAuthorizationHeader();
  const body = json !== undefined ? JSON.stringify(json) : rest.body;
  const hasJsonBody = json !== undefined;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...(auth ? { Authorization: auth } : {}),
      ...(headers as Record<string, string>),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw makeApiError(res.status, text);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Same URL and Basic Auth as `apiFetch`, for callers that need `Response`
 * (e.g. `blob()` on web). Combine with `ensureApiOk` for consistent errors.
 */
export function fetchWithApiAuth(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const auth = getApiBasicAuthorizationHeader();
  const headers = new Headers(init.headers);
  if (auth && !headers.has("Authorization")) {
    headers.set("Authorization", auth);
  }
  return fetch(url, { ...init, headers });
}

/** If `res.ok`, return `res`; otherwise read the body and throw `ApiError` (same as `apiFetch`). */
export async function ensureApiOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  const text = await res.text();
  throw makeApiError(res.status, text);
}
