import React from 'react';
import { ThemedText } from './ThemedText';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText tone="muted" weight="semibold" size={11} className="uppercase tracking-wide">
      {children}
    </ThemedText>
  );
}
