import type { ReactNode } from "react";
import type {
  GestureResponderEvent,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Text, Tooltip } from "react-native-paper";
import { COLORS } from "@/theme";
import { isWeb } from "@/lib/device";

type Props = {
  children: ReactNode;
  onPress: () => void;
  icon?: string;
  compact?: boolean;
  mode?: "contained" | "text";
  color?: string;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  disabled?: boolean;
};

export function AppButton({
  children,
  onPress,
  icon,
  compact,
  mode = "contained",
  color,
  style,
  loading,
  disabled,
}: Props) {
  const tint = color ?? (mode === "contained" ? COLORS.darkRed : COLORS.darkRed);
  return (
    <Button
      mode={mode}
      icon={icon}
      compact={compact}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      buttonColor={mode === "contained" ? tint : undefined}
      textColor={mode === "contained" ? "#FFFFFF" : tint}
      contentStyle={{
        justifyContent: "center",
        alignItems: "center",
      }}
      labelStyle={{
        textAlign: "center",
        marginHorizontal: 0,
        marginLeft: 0,
        marginRight: 0,
      }}
      style={style}
    >
      {children}
    </Button>
  );
}

type CircleActionButtonProps = {
  onPress: (e: GestureResponderEvent) => void;
  onPressIn?: (e: GestureResponderEvent) => void;
  onHoverIn?: PressableProps["onHoverIn"];
  onHoverOut?: PressableProps["onHoverOut"];
  accessibilityLabel: string;
  color?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  diameter?: number;
  iconSize?: number;
};

export function CircleActionButton({
  onPress,
  onPressIn,
  onHoverIn,
  onHoverOut,
  accessibilityLabel,
  color = COLORS.brightGreen,
  borderColor = "#FFFFFF",
  style,
  iconName = "plus",
  diameter = 30,
  iconSize = 16,
}: CircleActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={onPressIn}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onPress={onPress}
      style={[
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: color,
          borderWidth: 2,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <MaterialCommunityIcons name={iconName} size={iconSize} color="#FFFFFF" />
    </Pressable>
  );
}

type IngredientShoppingToggleButtonProps = {
  /** True when this recipe ingredient line is already on the active shopping list. */
  onShoppingList: boolean;
  ingredientName: string;
  onPress: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

/** White circle with green outline: plus (add) vs check (on list). */
export function IngredientShoppingToggleButton({
  onShoppingList,
  ingredientName,
  onPress,
  style,
}: IngredientShoppingToggleButtonProps) {
  const tooltipTitle = onShoppingList
    ? "Remove from the shopping list"
    : "Add to the shopping list";

  const core = !onShoppingList ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${ingredientName} to shopping list`}
      onPress={onPress}
      style={[
        {
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: "#FFFFFF",
          borderWidth: 2,
          borderColor: COLORS.brightGreen,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name="plus"
        size={20}
        color={COLORS.brightGreen}
      />
    </Pressable>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${ingredientName} from shopping list`}
      onPress={onPress}
      style={[
        {
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: "#FFFFFF",
          borderWidth: 2,
          borderColor: COLORS.brightGreen,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name="check"
        size={18}
        color={COLORS.brightGreen}
      />
    </Pressable>
  );

  if (!isWeb) {
    return core;
  }

  return <Tooltip title={tooltipTitle}>{core}</Tooltip>;
}

type PlannedToggleButtonProps = {
  planned: boolean;
  onToggle: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

export function PlannedToggleButton({
  planned,
  onToggle,
  style,
}: PlannedToggleButtonProps) {
  if (!planned) {
    return (
      <CircleActionButton
        accessibilityLabel="Add recipe to planned"
        onPress={onToggle}
        diameter={42}
        iconSize={24}
        style={style}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Remove recipe from planned"
      onPress={onToggle}
      style={[
        {
          minHeight: 30,
          borderRadius: 15,
          backgroundColor: "#FFFFFF",
          borderWidth: 2,
          borderColor: COLORS.brightGreen,
          paddingHorizontal: 10,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        variant="labelSmall"
        style={{
          color: COLORS.brightGreen,
          fontWeight: "700",
        }}
      >
        In planned
      </Text>
    </Pressable>
  );
}

