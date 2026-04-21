import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

type Props = {
  height?: number;
  /** When set (and no fixed height), box uses `width: 100%` + this ratio — matches grid thumbs. */
  aspectRatio?: number;
  /** "card" = shorter grid thumb; "hero" = detail header */
  variant?: "card" | "hero";
  style?: StyleProp<ViewStyle>;
};

/**
 * Neutral block when a recipe has no photo — similar to editorial recipe sites
 * that reserve image space before content loads.
 */
export function RecipeImagePlaceholder({
  height,
  aspectRatio,
  variant = "card",
  style,
}: Props) {
  const theme = useTheme();
  const useRatio = aspectRatio != null && aspectRatio > 0 && height == null;
  const h =
    height ??
    (useRatio ? undefined : variant === "hero" ? 220 : 120);

  return (
    <View
      style={[
        styles.box,
        {
          width: "100%",
          ...(useRatio
            ? { aspectRatio }
            : { height: h }),
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outlineVariant,
          ...(variant === "hero" ? { borderRadius: 12 } : null),
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name="image-outline"
        size={variant === "hero" ? 48 : 36}
        color={theme.colors.onSurfaceVariant}
        style={{ opacity: 0.45 }}
      />
      <Text
        variant="labelMedium"
        style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7, marginTop: 4 }}
      >
        Photo placeholder
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
