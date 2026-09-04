import React from 'react';
import Svg, { Circle, Path, Polygon, Polyline, Rect, Line } from 'react-native-svg';
import { theme } from '@/theme';

/**
 * The icon set, ported path-for-path from the artboards in `design/screens/`.
 *
 * Drawn rather than pulled from `@expo/vector-icons` on purpose: the design
 * needs a `translate` and a `tap` glyph that Feather does not ship, and mixing
 * icon families gives inconsistent stroke weights. One system, one weight.
 */
export type IconName =
  | 'settings'
  | 'mic'
  | 'zap'
  | 'stop'
  | 'play'
  | 'screen'
  | 'vibrate'
  | 'minus'
  | 'plus'
  | 'volume'
  | 'copy'
  | 'book'
  | 'translate'
  | 'tap'
  | 'chevronDown';

type Props = Readonly<{
  name: IconName;
  size?: number;
  color?: string;
  /** Filled glyphs ignore `strokeWidth`; `zap` is the only one. */
  strokeWidth?: number;
}>;

const FILLED: ReadonlySet<IconName> = new Set<IconName>(['zap', 'stop', 'play']);

/** Renders one icon from the design's set. */
export function Icon({
  name,
  size = 20,
  color = theme.color.ink,
  strokeWidth = 1.9,
}: Props): React.JSX.Element {
  const filled = FILLED.has(name);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      testID={`icon-${name}`}
    >
      {glyph(name)}
    </Svg>
  );
}

function glyph(name: IconName): React.JSX.Element {
  switch (name) {
    case 'settings':
      return (
        <>
          <Circle cx="12" cy="12" r="3" />
          <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
      );
    case 'mic':
      return (
        <>
          <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <Line x1="12" y1="19" x2="12" y2="23" />
        </>
      );
    case 'zap':
      return <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />;
    case 'stop':
      return <Rect x="5" y="5" width="14" height="14" rx="3" />;
    case 'play':
      return <Polygon points="7 4 20 12 7 20 7 4" />;
    case 'minus':
      return <Path d="M5 12h14" />;
    case 'plus':
      return (
        <>
          <Path d="M12 5v14" />
          <Path d="M5 12h14" />
        </>
      );
    case 'screen':
      return (
        <>
          <Rect x="3" y="4" width="18" height="12" />
          <Path d="M8 20h8" />
        </>
      );
    case 'vibrate':
      return (
        <>
          <Rect x="8" y="4" width="8" height="16" />
          <Path d="M4 9v6" />
          <Path d="M20 9v6" />
        </>
      );
    case 'volume':
      return (
        <>
          <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </>
      );
    case 'copy':
      return (
        <>
          <Rect x="9" y="9" width="13" height="13" rx="2" />
          <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      );
    case 'book':
      return (
        <>
          <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </>
      );
    case 'translate':
      return (
        <>
          <Path d="M4 7h10" />
          <Path d="M9 4v3c0 4-2 7-5 8" />
          <Path d="M8 12c1 3 3 5 6 6" />
          <Path d="M13 20l4-9 4 9" />
          <Path d="M14.5 17h5" />
        </>
      );
    case 'tap':
      return (
        <>
          <Circle cx="12" cy="12" r="2.5" />
          <Path d="M7.05 16.95a7 7 0 0 1 0-9.9" />
          <Path d="M16.95 7.05a7 7 0 0 1 0 9.9" />
        </>
      );
    case 'chevronDown':
      return <Polyline points="6 9 12 15 18 9" />;
  }
}
