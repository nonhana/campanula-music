import type { Attachment } from 'svelte/attachments';

export const measureRows = (
  minimum: () => number,
  changed: (height: number) => void,
): Attachment<HTMLElement> => {
  const heights = new Map<HTMLElement, number>();
  let observer: ResizeObserver | null = null;
  const publish = () => {
    if (heights.size) changed(Math.max(minimum(), ...heights.values()));
  };
  const ensureObserver = (): ResizeObserver => {
    observer ??= new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height =
          entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
        heights.set(entry.target as HTMLElement, Math.ceil(height) + 8);
      }
      publish();
    });
    return observer;
  };
  return (node) => {
    const current = ensureObserver();
    current.observe(node, { box: 'border-box' });
    return () => {
      current.unobserve(node);
      heights.delete(node);
      if (heights.size === 0) {
        current.disconnect();
        observer = null;
      }
    };
  };
};
