import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View, type ColorValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Reveal } from './Motion';
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
  color?: ColorValue;
}) {
  return (
    <Ionicons
      accessible={false}
      aria-hidden
      name={name}
      size={size}
      color={typeof color === 'string' ? color : theme.colors.primary}
    />
  );
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  appearance,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: IconName;
  appearance?: 'light' | 'ghost';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        secondary && ui.secondary,
        appearance === 'light' && ui.lightButton,
        appearance === 'ghost' && ui.ghostButton,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={18}
          color={secondary || appearance === 'light' ? theme.colors.primary : theme.colors.white}
        />
      )}
      <Text style={[ui.buttonText, (secondary || appearance === 'light') && ui.secondaryText]}>
        {title}
      </Text>
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
  const pulse = useSelectionPulse(active);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [ui.iconButton, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Animated.View style={pulse}>
        <Icon name={icon} color={active ? theme.colors.accent : theme.colors.primary} />
      </Animated.View>
    </Pressable>
  );
}
export function useSelectionPulse(selected: boolean | undefined) {
  const previous = useRef(selected);
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!reduce && selected && !previous.current) {
      scale.value = withSequence(
        withTiming(0.92, { duration: theme.motion.press / 2 }),
        withSpring(1, theme.motion.spring),
      );
    }
    previous.current = selected;
  }, [reduce, scale, selected]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const pulse = useSelectionPulse(selected);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.chip,
        selected && ui.chipActive,
        { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
      ]}
    >
      <Animated.Text style={[ui.chipText, selected && ui.chipTextActive, pulse]}>
        {label}
      </Animated.Text>
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
  return <Reveal>{children}</Reveal>;
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
