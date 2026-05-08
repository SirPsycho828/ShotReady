import { Tabs } from "expo-router";
import { Briefcase, Calendar, MapPin, Settings } from "lucide-react-native";
import { darkColors } from "@/theme/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: darkColors.accent,
        tabBarInactiveTintColor: darkColors.textMuted,
        tabBarStyle: {
          backgroundColor: darkColors.background,
          borderTopColor: darkColors.border,
          height: 56,
        },
        headerStyle: {
          backgroundColor: darkColors.background,
        },
        headerTintColor: darkColors.textPrimary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="route"
        options={{
          title: "Route",
          tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
