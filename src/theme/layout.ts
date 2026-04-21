import type { ViewStyle } from "react-native";
import { SPACING } from "./tokens";

export function centeredPageContainer(params: {
  isWeb: boolean;
  maxWidth: number;
  mobilePad?: number;
  webPad?: number;
  top?: number;
  bottom?: number;
}): ViewStyle {
  const {
    isWeb,
    maxWidth,
    mobilePad = SPACING.lg,
    webPad = 42,
    top = SPACING.pageTop,
    bottom = SPACING.xxl,
  } = params;
  return {
    paddingTop: top,
    paddingBottom: bottom,
    paddingHorizontal: isWeb ? webPad : mobilePad,
    ...(isWeb ? { maxWidth, alignSelf: "center" as const } : {}),
  };
}

export function centeredContentColumn(maxWidth: number): ViewStyle {
  return { width: "100%", maxWidth, alignSelf: "center" };
}
