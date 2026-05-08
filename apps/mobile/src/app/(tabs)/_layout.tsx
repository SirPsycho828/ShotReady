import { Tabs } from "expo-router";
import { Briefcase, Calendar, MapPin, Settings } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#5E6687",
        tabBarStyle: {
          backgroundColor: "#0F1117",
          borderTopColor: "#2E3347",
          height: 56,
        },
        headerStyle: {
          backgroundColor: "#0F1117",
        },
        headerTintColor: "#F1F3F9",
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
