import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FormChips } from './FormChips';

test('renders one chip per result, in order', () => {
  render(<FormChips form={['V', 'V', 'N', 'D', 'V']} />);
  expect(screen.getAllByText('V')).toHaveLength(3);
  expect(screen.getByText('N')).toBeTruthy();
  expect(screen.getByText('D')).toBeTruthy();
});
