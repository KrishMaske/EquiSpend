import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="scanner" options={{ gestureEnabled: false }} />
        <Stack.Screen name="results" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="history" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
