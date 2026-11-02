import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ColorValue,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ui } from './ui.styles';
import { theme } from '../../theme';
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({
  name,
  size = 22,
  color = theme.colors.primary,
}: {
  name: IconName;
  size?: number;
  color?: NonNullable<ColorValue>;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        secondary && ui.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon && <Icon name={icon} size={18} color={secondary ? theme.colors.primary : '#fff'} />}
      <Text style={[ui.buttonText, secondary && ui.secondaryText]}>{title}</Text>
    </Pressable>
  );
}
export function IconButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [ui.iconButton, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Icon name={icon} color={active ? theme.colors.accent : theme.colors.primary} />
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [ui.chip, selected && ui.chipActive, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[ui.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}
export function Screen({ children }: React.PropsWithChildren) {
  return (
    <SafeAreaView style={ui.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function FadeIn({ children }: React.PropsWithChildren) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
export function Photo({ uri, style }: { uri: string; style?: StyleProp<ImageStyle> }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (failed)
    return (
      <View
        style={[
          { backgroundColor: theme.colors.pale, alignItems: 'center', justifyContent: 'center' },
          style,
        ]}
      >
        <Icon name="image-outline" size={32} color={theme.colors.accent} />
        <Text style={ui.small}>여행의 한 장면</Text>
      </View>
    );
  return (
    <Image
      source={{ uri }}
      style={style}
      onError={() => setFailed(true)}
      accessibilityLabel="여행 분위기 참고 이미지"
    />
  );
}
export function Empty({ title, message }: { title: string; message: string }) {
  return (
    <View style={ui.empty}>
      <Icon name="compass-outline" size={36} color={theme.colors.accent} />
      <Text style={ui.subtitle}>{title}</Text>
      <Text style={[ui.body, { textAlign: 'center' }]}>{message}</Text>
    </View>
  );
}
