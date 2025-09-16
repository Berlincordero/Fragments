// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function Layout() {
  return (
    <SafeAreaProvider>
      {/* Header oculto en todas las pantallas */}
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}