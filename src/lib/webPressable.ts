import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { isWeb } from "./device";

type HoverIn = NonNullable<PressableProps["onHoverIn"]>;
type HoverOut = NonNullable<PressableProps["onHoverOut"]>;

export function webHoverHandlers(onHoverIn: HoverIn, onHoverOut: HoverOut) {
  if (!isWeb) {
    return {};
  }
  return { onHoverIn, onHoverOut };
}

export function webMouseHandlers(onMouseEnter: () => void, onMouseLeave: () => void) {
  if (!isWeb) {
    return {};
  }
  return { onMouseEnter, onMouseLeave } as Record<string, unknown>;
}

export const webPointerCursorStyle: StyleProp<ViewStyle> | null = isWeb
  ? ({ cursor: "pointer" } as object)
  : null;
