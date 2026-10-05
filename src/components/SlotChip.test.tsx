import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SlotChip } from './SlotChip';

test('renders the text it is given', () => {
  render(<SlotChip text="3–1" tone="score" />);
  expect(screen.getByText('3–1')).toBeTruthy();
});

test('renders the live label', () => {
  render(<SlotChip text="en cours" tone="live" />);
  expect(screen.getByText('en cours')).toBeTruthy();
});
