import { FLIGHT_ARC } from './motion-tokens.ts';

const FLIGHT_STEPS = 12;

// 元素摆在 to 上、缩放原点在左上角（translate 是相对 to 的）
export const flightArc = (from: DOMRect, to: DOMRect): Keyframe[] => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const bend = FLIGHT_ARC * length * (dx < 0 ? -1 : 1);
  const cx = from.x + dx / 2 + (dy / length) * bend;
  const cy = from.y + dy / 2 - (dx / length) * bend;
  return Array.from({ length: FLIGHT_STEPS + 1 }, (_, i) => {
    const t = i / FLIGHT_STEPS;
    const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x;
    const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y;
    const scale = (from.width + (to.width - from.width) * t) / to.width;
    return {
      transform: `translate(${x - to.x}px, ${y - to.y}px) scale(${scale})`,
    };
  });
};
