import { Platform } from "react-native";
import { Tabs } from "expo-router";

export default function TabLayout() {
  // On web, the AppNav component (rendered per-screen) provides a fixed top nav.
  // We hide the bottom tab bar on web since it's not needed.
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isWeb
          ? { display: "none" }
          : {
              backgroundColor: "#09090b",
              borderTopColor: "rgba(255,255,255,0.06)",
            },
        tabBarActiveTintColor: "rgb(52,211,153)",
        tabBarInactiveTintColor: "#52525b",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="progress" options={{ title: "Progress" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
    </Tabs>
  );
}
