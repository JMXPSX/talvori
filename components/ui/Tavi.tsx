/**
 * TAVI — the Talvori assistant mascot (see the "TAVI Mascot" design spec).
 *
 * Three fixed poses; the identity (leaf, crest, heart mask, house emblem) lives
 * in the art, never recolored or restyled here. Callers only choose a pose and a
 * size — the image scales proportionally and sits on a plain ground per the
 * mascot rules. `happy` is the resting/default state; `excited` is milestone-only;
 * `thinking` is the waiting/typing state.
 */

import { Image, type ImageStyle, type StyleProp } from 'react-native';

const POSES = {
  happy: require('../../assets/tavi/happy.png'),
  excited: require('../../assets/tavi/excited.png'),
  thinking: require('../../assets/tavi/thinking.png'),
} as const;

export type TaviPose = keyof typeof POSES;

export interface TaviProps {
  pose?: TaviPose;
  /** Rendered box side in px; the art keeps its aspect ratio inside it. */
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function Tavi({ pose = 'happy', size = 48, style }: TaviProps) {
  return (
    <Image
      source={POSES[pose]}
      accessibilityLabel="TAVI"
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}
