import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import ExploreScreen from "../screens/ExploreScreen";
import HomeScreen from "../screens/HomeScreen";
import MirrorScreen from "../screens/MirrorScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import VideoPlayerScreen from "../screens/VideoPlayerScreen";
import ViralMechanicsScreen from "../screens/ViralMechanicsScreen";
import DailyQuestionScreen from "../screens/DailyQuestionScreen";
import { colors } from "../theme/mvp";

const Tab = createBottomTabNavigator();

const iconMap: Record<string, { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }> = {
  Home: { active: "home", idle: "home-outline" },
  Explore: { active: "compass", idle: "compass-outline" },
  Mirror: { active: "radio-button-on", idle: "radio-button-off-outline" },
  Profile: { active: "person", idle: "person-outline" },
};

export default function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: "rgba(255,255,255,0.44)",
        tabBarStyle: {
          backgroundColor: "#09090D",
          borderTopColor: "rgba(255,255,255,0.08)",
          height: 74,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = iconMap[route.name] || { active: "ellipse", idle: "ellipse-outline" };
          return (
            <Ionicons
              name={focused ? icons.active : icons.idle}
              size={size}
              color={focused ? colors.accentWarm : color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Mirror" component={MirrorScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tab.Screen
        name="VideoPlayer"
        component={VideoPlayerScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: "none" },
        }}
      />
    </Tab.Navigator>
  );
}
