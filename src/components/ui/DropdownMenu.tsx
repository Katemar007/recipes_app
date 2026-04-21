import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import { webHoverHandlers } from "@/lib/webPressable";
import { FONT_DM_SANS_NAV_BOLD, FONT_DM_SANS_NAV_MEDIUM } from "@/theme";
import { useBreakpoint } from "../../hooks/useBreakpoint";

type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DropdownMenuItem = {
  key: string;
  label: string;
};

type Props = {
  visible: boolean;
  items: DropdownMenuItem[];
  selected?: string | null;
  onSelect: (item: DropdownMenuItem) => void;
  onClose: () => void;
  anchorRect: AnchorRect | null;
  maxHeight?: number;
};

const MOBILE_BG = "#F5F1EB";
const HOVER_BG = "#EAF7F0";
const HOVER_FG = "#2F6F4E";
const ACTIVE_BG = "#DCEFE3";
const ACTIVE_FG = "#1B4332";
const DEFAULT_FG = "#252320";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function DropdownMenu({
  visible,
  items,
  selected,
  onSelect,
  onClose,
  anchorRect,
  maxHeight,
}: Props) {
  const { width, isMobile, isTablet } = useBreakpoint();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [anim, visible]);

  const menuWidth = useMemo(() => {
    if (isMobile) return Math.min(width * 0.9, 420);
    if (isTablet) return clamp(width * 0.32, 280, 320);
    return 260;
  }, [isMobile, isTablet, width]);

  const top = anchorRect ? anchorRect.y + anchorRect.height + 8 : 86;
  const rawLeft = isMobile
    ? (width - menuWidth) / 2
    : anchorRect
      ? anchorRect.x + anchorRect.width - menuWidth
      : width - menuWidth - 16;
  const left = clamp(rawLeft, 12, Math.max(12, width - menuWidth - 12));

  const itemHeight = isMobile ? 46 : 42;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: isMobile ? `${MOBILE_BG}99` : "transparent" },
        ]}
      />

      <Animated.View
        style={[
          styles.menu,
          {
            width: menuWidth,
            left,
            top,
            maxHeight,
            padding: isMobile ? 10 : 8,
            borderRadius: isMobile ? 14 : 12,
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-6, 0],
                }),
              },
            ],
          },
        ]}
      >
        {items.map((item) => {
          const active = selected === item.key;
          const hovered = hoveredKey === item.key;
          const bg = active ? ACTIVE_BG : hovered ? HOVER_BG : "transparent";
          const fg = active ? ACTIVE_FG : hovered ? HOVER_FG : DEFAULT_FG;

          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item)}
              {...webHoverHandlers(
                () => setHoveredKey(item.key),
                () => setHoveredKey(null)
              )}
              style={({ pressed }) => [
                styles.item,
                {
                  height: itemHeight,
                  paddingHorizontal: isMobile ? 16 : 14,
                  backgroundColor: pressed ? HOVER_BG : bg,
                },
              ]}
            >
              <View style={styles.itemInner}>
                <Text
                  variant="bodyMedium"
                  style={{
                    fontFamily: active
                      ? FONT_DM_SANS_NAV_BOLD
                      : FONT_DM_SANS_NAV_MEDIUM,
                    color: fg,
                  }}
                >
                  {item.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    shadowColor: "#251F1A",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  item: {
    borderRadius: 10,
    justifyContent: "center",
  },
  itemInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
});

