import React from 'react';
import { Pressable, View } from 'react-native';
import { Card, CardRow } from './Card';
import { Avatar } from './Avatar';
import { ThemedText } from './ThemedText';
import type { RankingRow } from '../types';

export function RankingCard({
  rows,
  formatValue,
  onPressPlayer,
}: {
  rows: RankingRow[];
  formatValue: (value: number) => string;
  onPressPlayer: (playerId: string) => void;
}) {
  return (
    <Card>
      {rows.map((row, index) => (
        <Pressable key={row.player_id} onPress={() => onPressPlayer(row.player_id)} accessibilityRole="button">
          <CardRow isFirst={index === 0} testID={`ranking-row-${row.player_id}`}>
            <ThemedText mono weight="semibold" size={14} tone="faint" style={{ width: 20 }}>
              {row.rank}
            </ThemedText>
            <Avatar size={32} />
            <View className="flex-1">
              <ThemedText weight="medium" size={14.5}>{row.firstname} {row.lastname}</ThemedText>
              <ThemedText tone="muted" size={11.5} className="mt-0.5">{row.team_name}</ThemedText>
            </View>
            <ThemedText mono weight="semibold" size={13.5}>{formatValue(row.value)}</ThemedText>
          </CardRow>
        </Pressable>
      ))}
    </Card>
  );
}
