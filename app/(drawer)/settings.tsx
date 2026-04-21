import { ScrollView, View } from "react-native";
import { List, Text, useTheme } from "react-native-paper";

export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerClassName="p-4 pb-12">
        <Text variant="bodyLarge" className="mb-4" style={{ opacity: 0.9 }}>
          Organizer preferences and account options will live here. Recipes are
          loaded from the API when the backend is running (SQLite file under{" "}
          <Text style={{ fontFamily: "monospace" }}>backend/data/</Text>).
        </Text>
        <List.Section>
          <List.Subheader>Coming soon</List.Subheader>
          <List.Item title="Default units" description="US vs metric (European)" />
          <List.Item title="Theme" description="Light / dark" />
          <List.Item title="Export" description="Backup recipes" />
        </List.Section>
      </ScrollView>
    </View>
  );
}
