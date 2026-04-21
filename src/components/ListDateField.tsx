import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import { formatListDateLabel, parseLocalISODate, toLocalISODate } from "@/lib/dateLocal";

type Props = {
  valueISO: string;
  onChangeISO: (iso: string) => void;
};

export function ListDateField({ valueISO, onChangeISO }: Props) {
  const theme = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);

  const dateObj = parseLocalISODate(valueISO) ?? new Date();

  if (Platform.OS === "web") {
    return (
      <TextInput
        mode="outlined"
        label="List date"
        placeholder="YYYY-MM-DD"
        value={valueISO}
        onChangeText={(t) => onChangeISO(t.slice(0, 10))}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ backgroundColor: "#FFFFFF" }}
      />
    );
  }

  if (Platform.OS === "android") {
    return (
      <View>
        <Pressable
          onPress={() => setAndroidOpen(true)}
          style={[styles.touchRow, { borderColor: theme.colors.outline }]}
        >
          <Text variant="bodyLarge">{formatListDateLabel(valueISO)}</Text>
        </Pressable>
        {androidOpen ? (
          <DateTimePicker
            value={dateObj}
            mode="date"
            display="default"
            onChange={(event, selected) => {
              setAndroidOpen(false);
              if (event.type === "set" && selected) {
                onChangeISO(toLocalISODate(selected));
              }
            }}
          />
        ) : null}
      </View>
    );
  }

  // iOS
  return (
    <View>
      <Pressable
        onPress={() => setIosOpen(true)}
        style={[styles.touchRow, { borderColor: theme.colors.outline }]}
      >
        <Text variant="bodyLarge">{formatListDateLabel(valueISO)}</Text>
      </Pressable>
      <Modal visible={iosOpen} transparent animationType="slide">
        <View style={styles.iosBackdrop}>
          <View
            style={[
              styles.iosSheet,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <DateTimePicker
              value={dateObj}
              mode="date"
              display="spinner"
              onChange={(_, selected) => {
                if (selected) onChangeISO(toLocalISODate(selected));
              }}
            />
            <Button mode="contained" onPress={() => setIosOpen(false)}>
              Done
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  touchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: "#FFFFFF",
  },
  iosBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  iosSheet: {
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
});
