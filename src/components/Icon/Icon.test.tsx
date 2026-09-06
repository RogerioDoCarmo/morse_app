import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Icon, type IconName } from './Icon';

const NAMES: readonly IconName[] = [
  'settings',
  'mic',
  'zap',
  'volume',
  'copy',
  'book',
  'translate',
  'tap',
  'chevronDown',
  'chevronRight',
  'arrowLeft',
];

describe('Icon', () => {
  it.each(NAMES)('renders %s', (name) => {
    render(<Icon name={name} />);
    expect(screen.getByTestId(`icon-${name}`)).toBeOnTheScreen();
  });

  it('strokes outlined glyphs and fills the solid one', () => {
    render(<Icon name="mic" color="#123456" />);
    expect(screen.getByTestId('icon-mic')).toHaveProp('stroke', '#123456');

    render(<Icon name="zap" color="#abcdef" />);
    expect(screen.getByTestId('icon-zap')).toHaveProp('fill', '#abcdef');
  });

  it('takes the size it is given', () => {
    render(<Icon name="copy" size={33} />);
    const icon = screen.getByTestId('icon-copy');
    expect(icon).toHaveProp('width', 33);
    expect(icon).toHaveProp('height', 33);
  });
});
