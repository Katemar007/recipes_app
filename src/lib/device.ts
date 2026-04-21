import { Platform } from "react-native";

/** Web vs native — use for hover/cursor and other web-only behavior. */
export const isWeb = Platform.OS === "web";

export const BREAKPOINTS = {
  phoneMax: 759,
  tabletMax: 1179,
} as const;

export type DeviceClass = "phone" | "tablet" | "desktop";

export function deviceClassForWidth(width: number): DeviceClass {
  if (width <= BREAKPOINTS.phoneMax) return "phone";
  if (width <= BREAKPOINTS.tabletMax) return "tablet";
  return "desktop";
}

export function isPhoneWidth(width: number): boolean {
  return deviceClassForWidth(width) === "phone";
}

export function isTabletWidth(width: number): boolean {
  return deviceClassForWidth(width) === "tablet";
}

export function isDesktopWidth(width: number): boolean {
  return deviceClassForWidth(width) === "desktop";
}

export function isNativePlatform(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}
