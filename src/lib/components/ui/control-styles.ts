// @unocss-include：共享类名保留在 TypeScript 中，也要进入两个构建的样式提取。
export const pillBase =
  'pill-hit h-10 inline-flex flex-none items-center justify-center whitespace-nowrap rounded-full text-label font-500 transition-[background-color,border-color,color,opacity,transform] duration-feedback disabled:cursor-not-allowed';

export const pillLooks = {
  primary: {
    color:
      'bg-primary-900 text-white disabled:(bg-neutral-200 text-neutral-500)',
    hover: 'mouse:enabled:hover:bg-primary-950',
    link: 'press mouse:hover:bg-primary-950',
  },
  download: {
    color:
      'bg-secondary-100 text-secondary-900 disabled:(bg-neutral-200 text-neutral-500)',
    hover: 'mouse:enabled:hover:bg-secondary-200',
  },
  outline: {
    color:
      'border border-neutral-200 bg-white text-neutral-800 disabled:opacity-50',
    hover: 'mouse:enabled:hover:(border-primary-300 bg-primary-50)',
  },
  destructive: {
    color: 'bg-error-700 text-white disabled:(bg-neutral-200 text-neutral-500)',
    hover: 'mouse:enabled:hover:bg-error-800',
  },
};

export const settingsLink =
  'min-h-14 flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-ambient transition-colors duration-feedback active:bg-neutral-50 mouse:hover:bg-neutral-50';
