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
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: theme.colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '지도',
          tabBarIcon: ({ color }) => <Icon name="compass-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: '찜한 장소',
          tabBarIcon: ({ color }) => <Icon name="bookmark-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="experiences"
        options={{
          title: '내 여행',
          tabBarIcon: ({ color }) => <Icon name="journal-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '취향 DNA',
          tabBarIcon: ({ color }) => <Icon name="finger-print-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
