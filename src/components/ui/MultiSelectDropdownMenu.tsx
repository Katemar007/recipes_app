import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Checkbox, Text } from "react-native-paper";
import { webHoverHandlers } from "@/lib/webPressable";
import { COLORS } from "@/theme";
import { useBreakpoint } from "../../hooks/useBreakpoint";

export type MultiSelectMenuItem = {
  key: string;
  label: string;
};

type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  visible: boolean;
  items: MultiSelectMenuItem[];
  /** Whether each item is selected (e.g. by key or normalized label). */
  isSelected: (item: MultiSelectMenuItem) => boolean;
  onToggle: (item: MultiSelectMenuItem) => void;
  onClose: () => void;
  anchorRect: AnchorRect | null;
  maxHeight?: number;
  title?: string;
  /** Shown when `items` is empty so the menu is not a blank sheet. */
  emptyListMessage?: string;
};

const MOBILE_BG = "#F5F1EB";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function MultiSelectDropdownMenu({
  visible,
  items,
  isSelected,
  onToggle,
  onClose,
  anchorRect,
  maxHeight = 320,
  title,
  emptyListMessage,
}: Props) {
  const { width } = useBreakpoint();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [anim, visible]);

  const menuLayout = useMemo(() => {
    if (anchorRect) {
      const w = clamp(anchorRect.width, 200, width - 24);
      const left = clamp(anchorRect.x, 12, Math.max(12, width - w - 12));
      const top = anchorRect.y + anchorRect.height + 8;
      return { width: w, left, top };
    }
    const w = Math.min(width * 0.92, 400);
    return { width: w, left: (width - w) / 2, top: 120 };
  }, [anchorRect, width]);

  const rowHeight = 48;

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
          { backgroundColor: `${MOBILE_BG}99` },
        ]}
      />

      <Animated.View
        style={[
          styles.menu,
          {
            width: menuLayout.width,
            left: menuLayout.left,
            top: menuLayout.top,
            maxHeight,
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
        {title ? (
          <Text variant="labelLarge" style={styles.menuTitle}>
            {title}
          </Text>
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{
            maxHeight: Math.max(
              120,
              maxHeight - (title ? 52 : 16)
            ),
          }}
          nestedScrollEnabled
        >
          {items.length === 0 && emptyListMessage ? (
            <Text
              variant="bodyMedium"
              style={{ paddingHorizontal: 12, paddingVertical: 14, opacity: 0.75 }}
            >
              {emptyListMessage}
            </Text>
          ) : null}
          {items.map((item) => {
            const on = isSelected(item);
            const hovered = hoveredKey === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => onToggle(item)}
                {...webHoverHandlers(
                  () => setHoveredKey(item.key),
                  () => setHoveredKey(null)
                )}
                style={({ pressed }) => [
                  styles.row,
                  {
                    minHeight: rowHeight,
                    backgroundColor: pressed || hovered ? "#EAF7F0" : "transparent",
                  },
                ]}
              >
                <View pointerEvents="none">
                  <Checkbox.Android
                    status={on ? "checked" : "unchecked"}
                    onPress={() => {}}
                    color={COLORS.darkRed}
                  />
                </View>
                <Text
                  variant="bodyLarge"
                  style={[styles.rowLabel, on && styles.rowLabelSelected]}
                  numberOfLines={2}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: "#251F1A",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  menuTitle: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    opacity: 0.85,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
  },
  rowLabel: {
    flex: 1,
    color: "#252320",
  },
  rowLabelSelected: {
    fontWeight: "600",
  },
});
