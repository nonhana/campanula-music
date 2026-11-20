let scLoaded = false;
let jaLoaded = false;
let tcLoaded = false;

export const loadScFont = (): void => {
  if (scLoaded || typeof document === 'undefined') return;
  scLoaded = true;
  void import('@fontsource-variable/noto-sans-sc');
};

export const ensureScriptFont = (script: 'ja' | 'zh-TW'): void => {
  if (typeof document === 'undefined') return;
  if (script === 'ja') {
    if (jaLoaded) return;
    jaLoaded = true;
    void import('@fontsource-variable/noto-sans-jp');
    return;
  }
  if (tcLoaded) return;
  tcLoaded = true;
  void import('@fontsource-variable/noto-sans-tc');
};
