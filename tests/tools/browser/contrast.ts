import { writeFile } from 'node:fs/promises';

import { expect } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';

interface TextProbe {
  wrappers: HTMLElement[];
  ancestors: { node: HTMLElement; style: string | null }[];
  animations: Animation[];
  style: HTMLStyleElement;
}

declare global {
  interface Window {
    __campanulaContrast?: TextProbe;
  }
}

// W3C G18 uses specified text colors; black/white probes separate glyph antialiasing from masks/opacity.
export const measureContrast = async (page: Page, selectors: string[]) => {
  try {
    const targets = await page.evaluate((selectors) => {
      if (window.__campanulaContrast)
        throw new Error('contrast probe already active');
      const style = document.createElement('style');
      document.head.append(style);
      const probe: TextProbe = {
        wrappers: [],
        ancestors: [],
        animations: [],
        style,
      };
      window.__campanulaContrast = probe;
      for (const animation of document.getAnimations()) {
        if (animation.playState === 'running') {
          animation.pause();
          probe.animations.push(animation);
        }
      }
      const texts = new Map<Text, HTMLElement>();
      const ancestors = new Set<HTMLElement>();
      return selectors.map((selector) => {
        const matches = document.querySelectorAll<HTMLElement>(selector);
        if (matches.length !== 1)
          throw new Error(
            `${selector}: expected one target, got ${matches.length}`,
          );
        const element = matches[0];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const fragments = [];
        while (walker.nextNode()) {
          const text = walker.currentNode as Text;
          if (!text.textContent?.trim()) continue;
          const parent = text.parentElement!;
          const computed = getComputedStyle(parent);
          const range = document.createRange();
          range.selectNodeContents(text);
          const rects = [...range.getClientRects()].map(
            ({ x, y, width, height }) => ({ x, y, width, height }),
          );
          if (!texts.has(text)) {
            const wrapper = document.createElement('span');
            wrapper.dataset.contrastText = '';
            text.replaceWith(wrapper);
            wrapper.append(text);
            probe.wrappers.push(wrapper);
            texts.set(text, wrapper);
          }
          fragments.push({
            wrapper: probe.wrappers.indexOf(texts.get(text)!),
            text: text.textContent,
            color: computed.webkitTextFillColor,
            fontSize: computed.fontSize,
            fontWeight: computed.fontWeight,
            rects,
          });
          for (
            let node: HTMLElement | null = parent;
            node;
            node = node.parentElement
          ) {
            if (ancestors.has(node)) continue;
            ancestors.add(node);
            const css = getComputedStyle(node);
            if (css.filter !== 'none' || css.mixBlendMode !== 'normal')
              throw new Error(`${selector}: unsupported text filter/blend`);
            if (css.maskImage !== 'none' || css.opacity !== '1')
              probe.ancestors.push({ node, style: node.getAttribute('style') });
          }
        }
        return { selector, text: element.textContent, fragments };
      });
    }, selectors);
    const screenshot = async () =>
      (await page.screenshot({ scale: 'css', caret: 'hide' })).toString(
        'base64',
      );
    const paint = async (color: string, bare = false) => {
      await page.evaluate(
        ({ color, bare }) => {
          const probe = window.__campanulaContrast!;
          probe.style.textContent = `[data-contrast-text] { color:${color}!important;-webkit-text-fill-color:${color}!important;text-shadow:none!important;text-decoration-color:transparent!important; }`;
          if (bare)
            for (const { node } of probe.ancestors) {
              // Keep the mask layer so Chromium rasterizes both reference glyphs alike.
              if (getComputedStyle(node).maskImage !== 'none')
                node.style.setProperty(
                  'mask',
                  'linear-gradient(white, white)',
                  'important',
                );
              node.style.setProperty('opacity', '1', 'important');
            }
        },
        { color, bare },
      );
      return screenshot();
    };
    const original = await screenshot();
    const background = await paint('transparent');
    const black = await paint('black');
    const white = await paint('white');
    const bareBlack = await paint('black', true);
    const bareWhite = await paint('white', true);
    return await page.evaluate(
      async ({ targets, images }) => {
        for (const target of targets)
          for (const fragment of target.fragments) {
            const range = document.createRange();
            range.selectNodeContents(
              window.__campanulaContrast!.wrappers[fragment.wrapper],
            );
            const actual = [...range.getClientRects()];
            if (
              actual.length !== fragment.rects.length ||
              actual.some((rect, index) => {
                const expected = fragment.rects[index];
                return (['x', 'y', 'width', 'height'] as const).some(
                  (key) => Math.abs(rect[key] - expected[key]) > 0.05,
                );
              })
            )
              throw new Error(
                `${target.selector}: text moved during contrast capture`,
              );
          }
        const pixels = await Promise.all(
          images.map(async (encoded) => {
            const bytes = Uint8Array.from(atob(encoded), (char) =>
              char.charCodeAt(0),
            );
            const bitmap = await createImageBitmap(
              new Blob([bytes], { type: 'image/png' }),
            );
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext('2d', {
              willReadFrequently: true,
            })!;
            context.drawImage(bitmap, 0, 0);
            bitmap.close();
            return context.getImageData(0, 0, canvas.width, canvas.height);
          }),
        );
        const [original, background, black, white, bareBlack, bareWhite] =
          pixels;
        if (original.width !== innerWidth || original.height !== innerHeight)
          throw new Error(
            'contrast screenshot and CSS viewport coordinates differ',
          );
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = colorCanvas.height = 1;
        const colorContext = colorCanvas.getContext('2d', {
          willReadFrequently: true,
        })!;
        const colors = new Map<string, number[]>();
        const colorOf = (value: string) => {
          if (!colors.has(value)) {
            colorContext.clearRect(0, 0, 1, 1);
            colorContext.fillStyle = value;
            colorContext.fillRect(0, 0, 1, 1);
            colors.set(value, [...colorContext.getImageData(0, 0, 1, 1).data]);
          }
          return colors.get(value)!;
        };
        const luminance = (rgb: number[]) =>
          rgb
            .map((channel) => {
              const value = channel / 255;
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            })
            .reduce(
              (sum, value, index) =>
                sum + value * [0.2126, 0.7152, 0.0722][index],
              0,
            );
        return targets.map((target) => {
          let minimum = Infinity;
          let samples = 0;
          let painted = 0;
          let worst: {
            x: number;
            y: number;
            foreground: number[];
            background: number[];
            sourceColor: string;
            opacity: number;
          } | null = null;
          const visited = new Set<string>();
          for (const fragment of target.fragments)
            for (const rect of fragment.rects) {
              for (
                let y = Math.max(0, Math.floor(rect.y));
                y < Math.min(original.height, Math.ceil(rect.y + rect.height));
                y++
              ) {
                for (
                  let x = Math.max(0, Math.floor(rect.x));
                  x < Math.min(original.width, Math.ceil(rect.x + rect.width));
                  x++
                ) {
                  const offset = (y * original.width + x) * 4;
                  const key = `${offset}:${fragment.color}`;
                  if (visited.has(key)) continue;
                  visited.add(key);
                  const bareDelta = [0, 1, 2].reduce(
                    (sum, i) =>
                      sum +
                      bareWhite.data[offset + i] -
                      bareBlack.data[offset + i],
                    0,
                  );
                  const bareCoverage = bareDelta / (255 * 3);
                  if (bareCoverage < 0.5) continue;
                  samples++;
                  const coverage = [0, 1, 2].reduce(
                    (sum, i) =>
                      sum + white.data[offset + i] - black.data[offset + i],
                    0,
                  );
                  if (coverage <= 1) continue;
                  painted++;
                  const bg = [0, 1, 2].map((i) => background.data[offset + i]);
                  const source = colorOf(fragment.color);
                  const opacity =
                    (Math.min(1, coverage / bareDelta) * source[3]) / 255;
                  const fg = bg.map(
                    (value, i) => value + (source[i] - value) * opacity,
                  );
                  const first = luminance(fg);
                  const second = luminance(bg);
                  const ratio =
                    (Math.max(first, second) + 0.05) /
                    (Math.min(first, second) + 0.05);
                  if (ratio < minimum) {
                    minimum = ratio;
                    worst = {
                      x,
                      y,
                      foreground: fg,
                      background: bg,
                      sourceColor: fragment.color,
                      opacity,
                    };
                  }
                }
              }
            }
          return {
            ...target,
            samples,
            painted,
            minimum: Number.isFinite(minimum) ? minimum : null,
            worst,
          };
        });
      },
      {
        targets,
        images: [original, background, black, white, bareBlack, bareWhite],
      },
    );
  } finally {
    await page.evaluate(() => {
      const probe = window.__campanulaContrast;
      if (!probe) return;
      for (const { node, style } of probe.ancestors) {
        if (style === null) node.removeAttribute('style');
        else node.setAttribute('style', style);
      }
      probe.style.remove();
      for (const wrapper of probe.wrappers)
        wrapper.replaceWith(...wrapper.childNodes);
      for (const animation of probe.animations) animation.play();
      delete window.__campanulaContrast;
    });
  }
};

export const auditContrast = async (
  page: Page,
  info: TestInfo,
  state: string,
  targets: Record<string, Locator>,
  visibility: 'visible' | 'clipped' = 'visible',
) => {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(250);
  const entries = Object.entries(targets);
  for (const [id, locator] of entries) {
    await expect(locator, `${state}: ${id}`).toHaveCount(1);
    await locator.evaluate(
      (node, id) => node.setAttribute('data-contrast-target', id),
      id,
    );
  }
  try {
    const measured = await measureContrast(
      page,
      entries.map(([id]) => `[data-contrast-target="${id}"]`),
    );
    const result = measured.map((row, index) => ({
      id: entries[index][0],
      ...row,
    }));
    const path = info.outputPath(`contrast-${state}.json`);
    await writeFile(
      path,
      JSON.stringify(
        {
          state,
          project: info.project.name,
          viewport: page.viewportSize(),
          threshold: 4.5,
          visibility,
          result,
        },
        null,
        2,
      ),
    );
    await info.attach(`contrast-${state}`, {
      path,
      contentType: 'application/json',
    });
    await page.screenshot({ path: info.outputPath(`contrast-${state}.png`) });
    for (const row of result) {
      if (visibility === 'visible') {
        expect
          .soft(row.samples, `${state}: ${row.id} needs measurable glyphs`)
          .toBeGreaterThan(0);
        expect
          .soft(row.painted, `${state}: ${row.id} needs painted glyphs`)
          .toBeGreaterThan(0);
        expect
          .soft(row.minimum, `${state}: ${row.id} needs a measured ratio`)
          .not.toBeNull();
      }
      if (visibility === 'visible' || row.painted > 0)
        expect
          .soft(row.minimum ?? 0, `${state}: ${row.id}`)
          .toBeGreaterThanOrEqual(4.5);
    }
    return result;
  } finally {
    for (const [, locator] of entries)
      await locator.evaluate((node) =>
        node.removeAttribute('data-contrast-target'),
      );
  }
};
