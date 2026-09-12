import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SlotChip } from './SlotChip';

test('renders a played score', () => {
  render(<SlotChip text="3–1" tone="score" />);
  expect(screen.getByText('3–1')).toBeTruthy();
});

test('renders a live label', () => {
  render(<SlotChip text="en cours" tone="live" />);
  expect(screen.getByText('en cours')).toBeTruthy();
});

test('renders an odds percentage', () => {
  render(<SlotChip text="47 %" tone="odds" />);
  expect(screen.getByText('47 %')).toBeTruthy();
});
