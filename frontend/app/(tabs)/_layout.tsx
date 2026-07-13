// Tabs layout — Home / Search / Library / Gems / Profile
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/src/theme";

function TabIconWrap({ children, focused }) {
  return (
    <View style={{
      width: 44, height: 32, borderRadius: 999,
      alignItems: "center", justifyContent: "center",
      backgroundColor: focused ? `${COLORS.romance}22` : "transparent",
    }}>
      {children}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.romance,
        tabBarInactiveTintColor: COLORS.secondary,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 68 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
        },
        sceneStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, focused }) => (
        <TabIconWrap focused={focused}><Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} /></TabIconWrap>
      ) }} />
      <Tabs.Screen name="search" options={{ title: "Search", tabBarIcon: ({ color, focused }) => (
        <TabIconWrap focused={focused}><Ionicons name={focused ? "search" : "search-outline"} size={22} color={color} /></TabIconWrap>
      ) }} />
      <Tabs.Screen name="library" options={{ title: "Library", tabBarIcon: ({ color, focused }) => (
        <TabIconWrap focused={focused}><Ionicons name={focused ? "library" : "library-outline"} size={22} color={color} /></TabIconWrap>
      ) }} />
      <Tabs.Screen name="gems" options={{ title: "Gems", tabBarIcon: ({ color, focused }) => (
        <TabIconWrap focused={focused}>
          <View style={{ transform: [{ rotate: "45deg" }], width: 18, height: 18, borderRadius: 4, backgroundColor: color }} />
        </TabIconWrap>
      ) }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, focused }) => (
        <TabIconWrap focused={focused}><Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} /></TabIconWrap>
      ) }} />
    </Tabs>
  );
}
