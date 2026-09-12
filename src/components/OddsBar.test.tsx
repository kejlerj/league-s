import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OddsBar } from './OddsBar';

test('gives each segment a flex weight equal to its percentage', () => {
  render(<OddsBar home={34} draw={19} away={47} />);
  expect(screen.getByTestId('odds-home').props.style.flex).toBe(34);
  expect(screen.getByTestId('odds-draw').props.style.flex).toBe(19);
  expect(screen.getByTestId('odds-away').props.style.flex).toBe(47);
});

test('renders every percentage label', () => {
  render(<OddsBar home={34} draw={19} away={47} />);
  expect(screen.getByText('34 %')).toBeTruthy();
  expect(screen.getByText('19 %')).toBeTruthy();
  expect(screen.getByText('47 %')).toBeTruthy();
});
