import type { Attachment } from 'svelte/attachments';

export const measureRows = (
  minimum: () => number,
  changed: (height: number) => void,
): Attachment<HTMLElement> => {
  const heights = new Map<HTMLElement, number>();
  const publish = () => {
    if (heights.size) changed(Math.max(minimum(), ...heights.values()));
  };
  return (node) => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const height =
        entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      heights.set(node, Math.ceil(height) + 8);
      publish();
    });
    observer.observe(node, { box: 'border-box' });
    return () => {
      observer.disconnect();
      heights.delete(node);
      publish();
    };
  };
};
