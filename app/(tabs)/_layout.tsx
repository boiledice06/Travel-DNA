import { Tabs } from 'expo-router';
import { Icon } from '../../src/components/common/UI';
import { theme } from '../../src/theme';
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.line,
          minHeight: 54,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '지도',
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? 'compass' : 'compass-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: '찜한 장소',
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? 'bookmark' : 'bookmark-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="experiences"
        options={{
          title: '내 여행',
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? 'calendar' : 'calendar-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '취향 DNA',
          tabBarIcon: ({ color, focused }) => (
            <Icon name="finger-print-outline" color={color} size={focused ? 24 : 22} />
          ),
        }}
      />
    </Tabs>
  );
}
