import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Text } from "react-native-paper";
import { AppButton } from "@/components/ui/AppButton";
import { COLORS } from "@/theme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  /** Primary action label (default "OK"). */
  confirmLabel?: string;
  onConfirm: () => void;
};

/**
 * Centered modal for errors and other messages — avoids silent failures.
 */
export function CenterAlertModal({
  visible,
  title,
  message,
  confirmLabel = "OK",
  onConfirm,
}: Props) {
  const { width } = useWindowDimensions();
  const maxW = Math.min(360, width - 48);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onConfirm}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onConfirm}
        accessibilityLabel="Dismiss dialog"
      />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={[styles.card, { maxWidth: maxW, width: "100%" }]}>
          <Text variant="titleMedium" style={styles.title}>
            {title}
          </Text>
          <ScrollView
            style={styles.bodyScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <Text variant="bodyMedium" style={styles.body}>
              {message}
            </Text>
          </ScrollView>
          <AppButton
            mode="contained"
            color={COLORS.darkRed}
            style={styles.button}
            onPress={onConfirm}
          >
            {confirmLabel}
          </AppButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    zIndex: 0,
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    marginBottom: 10,
    color: COLORS.textPrimary,
    fontWeight: "600",
  },
  bodyScroll: {
    maxHeight: 220,
    marginBottom: 18,
  },
  body: {
    color: COLORS.textSecondary,
  },
  button: {
    alignSelf: "flex-end",
    minWidth: 88,
  },
});
