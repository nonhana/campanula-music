// 换屏时新旧外框同时挂着：按挂载先后排队，旧的卸下只撤自己那份
const seats: { value: string }[] = [];

const apply = (): void => {
  document.documentElement.style.scrollPaddingTop = seats.at(-1)?.value ?? '';
};

export interface PageScrollPadding {
  set: (value: string) => void;
  release: () => void;
}

export const pageScrollPadding = (): PageScrollPadding => {
  const seat = { value: '' };
  seats.push(seat);
  return {
    set(value) {
      if (seat.value === value) return;
      seat.value = value;
      apply();
    },
    release() {
      const index = seats.indexOf(seat);
      if (index !== -1) seats.splice(index, 1);
      apply();
    },
  };
};

export const stickyBelowHeader = (): number =>
  Number.parseFloat(
    document.documentElement.style.getPropertyValue('--sticky-below-header'),
  ) || 0;
