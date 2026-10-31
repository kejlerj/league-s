import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemedText } from './ThemedText';

test('renders its children', () => {
  render(<ThemedText>Bonjour</ThemedText>);
  expect(screen.getByText('Bonjour')).toBeTruthy();
});

test('mono applies an IBM Plex Mono font family', () => {
  render(<ThemedText mono weight="semibold">42</ThemedText>);
  const node = screen.getByText('42');
  expect(node.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ fontFamily: 'IBMPlexMono_600SemiBold' })])
  );
});
