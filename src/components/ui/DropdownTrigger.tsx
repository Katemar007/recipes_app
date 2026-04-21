import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { webHoverHandlers, webPointerCursorStyle } from "@/lib/webPressable";
import {
  COLORS,
  FONT_DM_SANS_NAV_BOLD,
  FONT_DM_SANS_NAV_MEDIUM,
} from "@/theme";

type Props = {
  label: string;
  open: boolean;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  style?: ViewStyle;
};

export function DropdownTrigger({
  label,
  open,
  active,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const highlighted = active || hovered;

  return (
    <Pressable
      onPress={onPress}
      {...webHoverHandlers(
        () => setHovered(true),
        () => setHovered(false)
      )}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: open }}
      style={[
        styles.base,
        style,
        highlighted && {
          borderBottomColor: COLORS.darkRed,
          borderBottomWidth: 2,
        },
        webPointerCursorStyle,
      ]}
    >
      <Text
        variant="labelLarge"
        style={{
          fontFamily: active ? FONT_DM_SANS_NAV_BOLD : FONT_DM_SANS_NAV_MEDIUM,
          color: highlighted ? COLORS.darkRed : theme.colors.onSurface,
        }}
      >
        {label}
      </Text>
      <MaterialCommunityIcons
        name={open ? "chevron-up" : "chevron-down"}
        size={20}
        color={highlighted ? COLORS.darkRed : theme.colors.onSurface}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
});

