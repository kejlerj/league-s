import React from 'react';
import { Text, type TextProps } from 'react-native';

type Tone = 'primary' | 'muted' | 'faint' | 'accent';
type Weight = 'normal' | 'medium' | 'semibold';

interface ThemedTextProps extends TextProps {
  tone?: Tone;
  mono?: boolean;
  weight?: Weight;
  size?: number;
  children: React.ReactNode;
}

const TONE_CLASS: Record<Tone, string> = {
  primary: 'text-textPrimary dark:text-textPrimaryDark',
  muted: 'text-textMuted dark:text-textMutedDark',
  faint: 'text-textFaint dark:text-textFaintDark',
  accent: 'text-accent dark:text-accentDark',
};

const WEIGHT_CLASS: Record<Weight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
};

const MONO_FAMILY: Record<Weight, string> = {
  normal: 'IBMPlexMono_400Regular',
  medium: 'IBMPlexMono_500Medium',
  semibold: 'IBMPlexMono_600SemiBold',
};

export function ThemedText({
  tone = 'primary',
  mono = false,
  weight = 'normal',
  size = 14,
  className,
  style,
  children,
  ...rest
}: ThemedTextProps) {
  return (
    <Text
      className={`${TONE_CLASS[tone]} ${WEIGHT_CLASS[weight]} ${className ?? ''}`}
      style={[
        { fontSize: size, fontFamily: mono ? MONO_FAMILY[weight] : undefined },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
