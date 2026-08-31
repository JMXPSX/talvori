/**
 * Donut chart via react-native-svg stroke segments. Pure presentation — pass
 * precomputed segments (fraction + offset in [0,1], + color). Renders a track
 * ring plus one arc per segment, starting at 12 o'clock.
 */

import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/components/ThemeProvider';

export interface DonutSegment {
  fraction: number;
  offset: number;
  color: string;
}

export interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
}

export function Donut({ segments, size = 160, stroke = 22 }: DonutProps) {
  const { palette } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={r} stroke={palette.surfaceMuted} strokeWidth={stroke} fill="none" />
      {segments.map((s, i) => (
        <Circle
          key={i}
          cx={center}
          cy={center}
          r={r}
          stroke={s.color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${s.fraction * c} ${c - s.fraction * c}`}
          strokeDashoffset={-s.offset * c}
          // "Soft stroke": rounded caps per the Talvori data-viz rule.
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      ))}
    </Svg>
  );
}
