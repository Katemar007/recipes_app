import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Central place for `EXPO_PUBLIC_*` reads. Import from here instead of
 * `process.env` scattered across the app.
 */

function defaultApiBaseUrl(): string {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return "http://localhost:8000";
}

/**
 * FastAPI base URL (no trailing slash).
 * Override with EXPO_PUBLIC_API_URL or app.json `extra.apiUrl`.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  defaultApiBaseUrl();

/** HTTP Basic user for Caddy (etc.); empty means skip Authorization. */
export const EXPO_PUBLIC_API_BASIC_USER =
  process.env.EXPO_PUBLIC_API_BASIC_USER?.trim() ?? "";

export const EXPO_PUBLIC_API_BASIC_PASSWORD =
  process.env.EXPO_PUBLIC_API_BASIC_PASSWORD ?? "";
