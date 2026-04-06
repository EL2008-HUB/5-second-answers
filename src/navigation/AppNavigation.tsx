import React from "react";
import * as ExpoLinking from "expo-linking";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BottomTabs from "./BottomTabs";
import AdminBadgesPanel from "../screens/AdminBadgesPanel";
import AiCopilotScreen from "../screens/AiCopilotScreen";
import AuthScreen from "../screens/AuthScreen";
import DebugScreen from "../screens/DebugScreen";
import DuetScreen from "../screens/DuetScreen";
import FriendPickerScreen from "../screens/FriendPickerScreen";
import GamificationScreen from "../screens/GamificationScreen";
import HashtagFeedScreen from "../screens/HashtagFeedScreen";
import CreateLabScreen from "../screens/CreateLabScreen";
import LaunchGateScreen from "../screens/LaunchGateScreen";
import NewsCategoryScreen from "../screens/NewsCategoryScreen";
import OnboardingInterestsScreen from "../screens/OnboardingInterestsScreen";
import ReferralScreen from "../screens/ReferralScreen";
import RoomScreen from "../screens/RoomScreen";
import RoomsLobbyScreen from "../screens/RoomsLobbyScreen";
import ShareScreen from "../screens/ShareScreen";
import StoryModeScreen from "../screens/StoryModeScreen";
import { flushPendingNavigation, navigationRef } from "./rootNavigation";

const Stack = createNativeStackNavigator();
const linking = {
  config: {
    screens: {
      LaunchGate: "",
      Room: "room/:inviteCode",
      RoomsLobby: "rooms",
    },
  },
  prefixes: [
    ExpoLinking.createURL("/"),
    "fivesecondanswers://",
    "https://5secondanswer.app",
    "https://www.5secondanswer.app",
  ],
};

export default function AppNavigation() {
  return (
    <NavigationContainer linking={linking} ref={navigationRef} onReady={flushPendingNavigation}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="LaunchGate" component={LaunchGateScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingInterestsScreen} />
        <Stack.Screen name="Main" component={BottomTabs} />
        <Stack.Screen name="AiCopilot" component={AiCopilotScreen} />
        <Stack.Screen name="CreateLab" component={CreateLabScreen} />
        <Stack.Screen name="Duet" component={DuetScreen} />
        <Stack.Screen name="FriendPicker" component={FriendPickerScreen} />
        <Stack.Screen name="Gamification" component={GamificationScreen} />
        <Stack.Screen name="HashtagFeed" component={HashtagFeedScreen} />
        <Stack.Screen name="NewsCategory" component={NewsCategoryScreen} />
        <Stack.Screen name="Referral" component={ReferralScreen} />
        <Stack.Screen name="Room" component={RoomScreen} />
        <Stack.Screen name="RoomsLobby" component={RoomsLobbyScreen} />
        <Stack.Screen name="Share" component={ShareScreen} />
        <Stack.Screen name="StoryMode" component={StoryModeScreen} />
        <Stack.Screen name="AdminBadges" component={AdminBadgesPanel} />
        <Stack.Screen name="Debug" component={DebugScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
