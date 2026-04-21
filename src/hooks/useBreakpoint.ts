import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { deviceClassForWidth } from "@/lib/device";

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const device = deviceClassForWidth(width);
    return {
      width,
      height,
      device,
      isMobile: device === "phone",
      isTablet: device === "tablet",
      isDesktop: device === "desktop",
    };
  }, [width, height]);
}

