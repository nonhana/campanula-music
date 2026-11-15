const NEVER = new Promise<void>(() => {});

export const never = (): Promise<void> => NEVER;

export const held = (): { until: Promise<void>; release: () => void } => {
  let release = (): void => {};
  const until = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { until, release };
};
