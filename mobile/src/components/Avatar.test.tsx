import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Crest } from './Avatar';

const hidden = { includeHiddenElements: true };

test('a crest with a logo shows the image', () => {
  render(<Crest name="US Bastille" uri="https://img.test/bastille.png" />);
  expect(screen.getByTestId('crest-image').props.source).toEqual({ uri: 'https://img.test/bastille.png' });
  expect(screen.queryByTestId('crest-initial', hidden)).toBeNull();
});

test('a crest without a logo shows the first letter of the name', () => {
  render(<Crest name="étoile de Charonne" uri={null} />);
  expect(screen.queryByTestId('crest-image')).toBeNull();
  expect(screen.getByTestId('crest-initial', hidden)).toHaveTextContent('É');
});

test('a logo that fails to load falls back to the initial', () => {
  render(<Crest name="AS Belleville" uri="https://img.test/broken.png" />);
  fireEvent(screen.getByTestId('crest-image'), 'error');
  expect(screen.queryByTestId('crest-image')).toBeNull();
  expect(screen.getByTestId('crest-initial', hidden)).toHaveTextContent('A');
});
