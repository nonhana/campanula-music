import { clamp } from './clamp';
import type { Grip, PointerSample } from './press';
import { rightButtonDown } from './press';

export interface SliderCoreOptions {
  // null 是这次按下不接（例如点在滑块前后的空白处）
  begin: (sample: PointerSample) => number | null;
  track: (sample: PointerSample) => number;
  commit: (value: number) => void;
  cancel: () => void;
  onValue: (value: number | null) => void;
}

export type SliderCore = Grip;

export const createSliderCore = ({
  begin,
  track,
  commit,
  cancel,
  onValue,
}: SliderCoreOptions): SliderCore => {
  let press: { pointerId: number; value: number } | null = null;

  const stop = () => {
    press = null;
  };

  const abandon = (pointerId?: number) => {
    if (!press || (pointerId !== undefined && pointerId !== press.pointerId))
      return;
    stop();
    cancel();
    onValue(null);
  };

  return {
    get holding() {
      return press !== null;
    },
    press(sample) {
      if (!sample.isPrimary || sample.button !== 0) return false;
      if (press) abandon();
      const value = begin(sample);
      if (value === null) return false;
      press = {
        pointerId: sample.pointerId,
        value: clamp(value, 0, 1),
      };
      onValue(press.value);
      return true;
    },
    move(sample) {
      if (!press || sample.pointerId !== press.pointerId) return;
      if (rightButtonDown(sample.buttons)) return abandon();
      press.value = clamp(track(sample), 0, 1);
      onValue(press.value);
    },
    release(sample) {
      if (!press || sample.pointerId !== press.pointerId) return;
      const { value } = press;
      stop();
      commit(value);
      onValue(null);
    },
    abandon,
    click() {
      return false;
    },
  };
};
