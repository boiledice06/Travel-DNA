import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, usePathname, Redirect } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { theme } from '../src/theme';
import { StatusBar } from 'expo-status-bar';
import { TravelProvider, useTravel } from '../src/hooks/useTravel';
import { Button } from '../src/components/common/UI';
import { ui } from '../src/components/common/ui.styles';
function Navigation() {
  const { ready, loadError, reload, saveError, retrySave, data } = useTravel();
  const path = usePathname();
  const reduce = useReducedMotion();
  if (!ready)
    return (
      <SafeAreaView style={[ui.screen, { justifyContent: 'center', padding: 28, gap: 20 }]}>
        <Text style={ui.title}>Travel DNA</Text>
        {loadError ? (
          <>
            <Text style={ui.body}>{loadError}</Text>
            <Button title="다시 불러오기" onPress={reload} />
          </>
        ) : (
          <ActivityIndicator color={theme.colors.primary} />
        )}
      </SafeAreaView>
    );
  if (
    !data.onboarded &&
    !path.startsWith('/onboarding') &&
    !path.startsWith('/experience/') &&
    path !== '/'
  )
    return <Redirect href="/onboarding" />;
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reduce ? 'none' : 'fade',
          animationDuration: theme.motion.transition,
        }}
      />
      {saveError && (
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#FFF0E8', padding: 12 }}>
          <Pressable accessibilityRole="button" onPress={retrySave}>
            <Text style={ui.small}>{saveError} ↻ 재시도</Text>
          </Pressable>
        </SafeAreaView>
      )}
    </View>
  );
}
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TravelProvider>
          <StatusBar style="dark" />
          <Navigation />
        </TravelProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
