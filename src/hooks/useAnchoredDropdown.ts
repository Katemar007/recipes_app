import { useCallback, useRef, useState } from "react";
import { Dimensions, type View } from "react-native";

type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Measurable = {
  measureInWindow?: (
    cb: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

export function useAnchoredDropdown() {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const anchorRef = useRef<View | null>(null);

  const openMenu = useCallback(() => {
    const winW = Dimensions.get("window").width;
    const fallbackRect = (): AnchorRect => ({
      x: 16,
      y: 140,
      width: Math.max(200, Math.min(420, winW - 32)),
      height: 52,
    });

    const measurable = anchorRef.current as unknown as Measurable | null;
    if (measurable?.measureInWindow) {
      measurable.measureInWindow((x, y, width, height) => {
        if (width < 4 || height < 4) {
          setAnchorRect(fallbackRect());
        } else {
          setAnchorRect({ x, y, width, height });
        }
        setOpen(true);
      });
      return;
    }
    setAnchorRect(fallbackRect());
    setOpen(true);
  }, []);

  const closeMenu = useCallback(() => setOpen(false), []);

  return {
    open,
    anchorRect,
    anchorRef,
    openMenu,
    closeMenu,
    setOpen,
  };
}

