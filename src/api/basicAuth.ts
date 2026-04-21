/**
 * Optional HTTP Basic credentials for Caddy (or any reverse proxy) in front of the API.
 * Set EXPO_PUBLIC_API_BASIC_USER and EXPO_PUBLIC_API_BASIC_PASSWORD in `.env`.
 * Omit either variable (or leave user empty) to skip the Authorization header.
 */

import {
  EXPO_PUBLIC_API_BASIC_PASSWORD,
  EXPO_PUBLIC_API_BASIC_USER,
} from "@/config/env";

function binaryStringToBase64(bin: string): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bin.length; i += 3) {
    const a = bin.charCodeAt(i);
    const b = i + 1 < bin.length ? bin.charCodeAt(i + 1) : 0;
    const c = i + 2 < bin.length ? bin.charCodeAt(i + 2) : 0;
    const bitmap = (a << 16) | (b << 8) | c;
    out += chars.charAt((bitmap >> 18) & 63);
    out += chars.charAt((bitmap >> 12) & 63);
    out += i + 1 < bin.length ? chars.charAt((bitmap >> 6) & 63) : "=";
    out += i + 2 < bin.length ? chars.charAt(bitmap & 63) : "=";
  }
  return out;
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }
  return binaryStringToBase64(binary);
}

/** `Basic <base64>` when user is set; otherwise `undefined` (local dev without Caddy auth). */
export function getApiBasicAuthorizationHeader(): string | undefined {
  if (!EXPO_PUBLIC_API_BASIC_USER) return undefined;
  return `Basic ${utf8ToBase64(
    `${EXPO_PUBLIC_API_BASIC_USER}:${EXPO_PUBLIC_API_BASIC_PASSWORD}`
  )}`;
}
