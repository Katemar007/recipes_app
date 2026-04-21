import { useEffect, useState } from "react";
import { useWindowDimensions } from "react-native";
import {
  Button,
  Dialog,
  HelperText,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";
import { ListDateField } from "@/components/ListDateField";
import { parseLocalISODate, toLocalISODate } from "@/lib/dateLocal";
import { COLORS } from "@/theme";

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onSave: (payload: { name: string; listDate: string }) => void;
  itemCount: number;
};

export function SaveShoppingListDialog({
  visible,
  onDismiss,
  onSave,
  itemCount,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const dialogWidth = Math.min(
    Math.round(screenWidth * 0.5),
    Math.max(0, screenWidth - 32)
  );

  const [name, setName] = useState("");
  const [listDateISO, setListDateISO] = useState(() =>
    toLocalISODate(new Date())
  );

  useEffect(() => {
    if (visible) {
      setName("");
      setListDateISO(toLocalISODate(new Date()));
    }
  }, [visible]);

  const dateOk = Boolean(parseLocalISODate(listDateISO));
  const canSave =
    itemCount > 0 && name.trim().length > 0 && dateOk;

  const saveBlockedHint = (() => {
    if (itemCount <= 0) {
      return "Add at least one item on the Shopping screen before saving.";
    }
    if (!name.trim()) {
      return "Type a name for this list to enable Save.";
    }
    if (!dateOk) {
      return "Use a valid date in YYYY-MM-DD format.";
    }
    return "";
  })();

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={{
          width: dialogWidth,
          alignSelf: "center",
          marginHorizontal: 0,
        }}
      >
        <Dialog.Title style={{ fontSize: 24, lineHeight: 30 }}>
          Save shopping list
        </Dialog.Title>
        <Dialog.Content>
          <Text variant="bodySmall" style={{ marginBottom: 12, opacity: 0.8 }}>
            Name this list and set the date you’re shopping (or the day it’s
            for).
          </Text>
          <TextInput
            mode="outlined"
            label="Name"
            placeholder="e.g. Weekly shop, Easter dinner"
            value={name}
            onChangeText={setName}
            style={{ backgroundColor: "#FFFFFF", marginBottom: 16 }}
          />
          <Text variant="labelLarge" style={{ marginBottom: 8 }}>
            Date
          </Text>
          <ListDateField valueISO={listDateISO} onChangeISO={setListDateISO} />
          {!canSave && saveBlockedHint ? (
            <HelperText type="info" visible style={{ marginTop: 12 }}>
              {saveBlockedHint}
            </HelperText>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            mode="contained"
            buttonColor={COLORS.brightGreen}
            textColor="#FFFFFF"
            disabled={!canSave}
            onPress={() => {
              onSave({
                name: name.trim(),
                listDate: listDateISO.trim(),
              });
              onDismiss();
            }}
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
