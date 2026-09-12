import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SegmentedTabs } from './SegmentedTabs';

test('calls onChange with the pressed index', () => {
  const onChange = jest.fn();
  render(<SegmentedTabs options={['Général', 'Buteurs']} value={0} onChange={onChange} />);
  fireEvent.press(screen.getByTestId('segmented-tab-Buteurs'));
  expect(onChange).toHaveBeenCalledWith(1);
});

test('marks the active segment as selected', () => {
  render(<SegmentedTabs options={['Général', 'Buteurs']} value={1} onChange={() => {}} />);
  expect(screen.getByTestId('segmented-tab-Buteurs').props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId('segmented-tab-Général').props.accessibilityState.selected).toBe(false);
});
