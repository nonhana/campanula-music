import { audioResponse, audioWav } from '../../_kit/mock/assets.ts';
import { auditContrast } from '../../tools/browser/contrast.ts';
import { expect, login, test } from '../fixture.ts';

for (const cover of ['black', 'white']) {
  test(`歌词在${cover}封面上未唱、正唱、唱完和滚动后主体阅读区仍清晰`, async ({
    page,
  }, info) => {
    await page.clock.install();
    const audio = audioWav(3433267939, 30);
    await page.route('**/mock-assets/audio/**', (route) =>
      route.fulfill(
        audioResponse(
          audio,
          route.request().method(),
          route.request().headers().range,
        ),
      ),
    );
    await page.route('**/mock-assets/cover/**', (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path fill="${cover}" d="M0 0h100v100H0z"/></svg>`,
      }),
    );
    await login(page, '/playlists/900000024');
    await page
      .locator('main [data-song-id="3433267939"] [data-play-target]')
      .click();
    await page.getByRole('button', { name: /^打开播放页/ }).click();
    const player = page.getByRole('dialog', { name: '正在播放', exact: true });
    await player.getByRole('button', { name: '暂停', exact: true }).click();
    if (info.project.name === 'phone')
      await player.getByRole('button', { name: '显示歌词' }).click();
    const lyrics = player.getByRole('group', { name: '歌词', exact: true });
    await expect(lyrics).toBeVisible();
    await expect(lyrics.locator('[data-line="3"] .word').first()).toBeVisible();
    await player.getByRole('button', { name: '音译', exact: true }).click();
    await expect(lyrics.locator('[data-line="3"] > .sub')).toHaveCount(2);
    await page.evaluate(() => document.fonts.ready);
    const progress = player.getByRole('slider', { name: '播放进度' });
    for (const state of [
      'unsung',
      'singing',
      'sung',
      'previous',
      'scrolled',
      'translation-only',
      'words-only',
    ] as const) {
      if (state === 'translation-only')
        await player.getByRole('button', { name: '音译', exact: true }).click();
      if (state === 'words-only')
        await player.getByRole('button', { name: '翻译', exact: true }).click();
      await progress.focus();
      await page.keyboard.press('Home');
      if (state === 'singing') await page.keyboard.press('ArrowRight');
      if (state === 'sung') {
        const box = (await progress.boundingBox())!;
        await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2);
      }
      if (state === 'previous' || state === 'scrolled') {
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
      }
      await expect(progress).toHaveAttribute(
        'aria-valuenow',
        {
          unsung: '0',
          singing: '5',
          sung: '6',
          previous: '10',
          scrolled: '10',
          'translation-only': '0',
          'words-only': '0',
        }[state],
      );
      if (state === 'scrolled') {
        await lyrics.focus();
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowDown');
      }
      await page.waitForTimeout(250);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
      try {
        const { band, fadeBottom, fadeTop, height, maskImage, targets } =
          await lyrics.evaluate((root, state) => {
            const bounds = root.getBoundingClientRect();
            const probe = document.createElement('div');
            probe.style.cssText =
              'position:absolute;top:0;left:0;width:0;visibility:hidden;pointer-events:none;';
            root.append(probe);
            const measure = (varName: string) => {
              probe.style.height = `var(${varName})`;
              return probe.getBoundingClientRect().height;
            };
            const fadeTop = measure('--fade-top');
            const fadeBottom = measure('--fade-bottom');
            probe.remove();
            const band = {
              top: bounds.top + fadeTop + 1,
              bottom: bounds.bottom - fadeBottom - 1,
            };
            const targets = [
              ...root.querySelectorAll<HTMLElement>('[data-line]'),
            ]
              .filter((line) => {
                const rect = line.getBoundingClientRect();
                return rect.bottom > band.top && rect.top < band.bottom;
              })
              .flatMap((line) => {
                const prefix = `[role="group"][aria-label="歌词"] [data-line="${line.dataset.line}"]`;
                return [
                  {
                    id: `lyrics.${line.querySelector('.word') ? 'word' : 'plain'}.line-${line.dataset.line}`,
                    selector: `${prefix} > .line-text`,
                  },
                  ...[...line.querySelectorAll('.sub')].map((_, index) => ({
                    id: `lyrics.${state !== 'translation-only' && index === 0 ? 'romanization' : 'translation'}.line-${line.dataset.line}`,
                    selector: `${prefix} > .sub:nth-of-type(${index + 2})`,
                  })),
                ];
              });
            return {
              band,
              fadeBottom,
              fadeTop,
              height: bounds.height,
              maskImage: getComputedStyle(root).maskImage,
              targets,
            };
          }, state);
        expect(maskImage).toContain('linear-gradient');
        expect(fadeTop).toBeGreaterThanOrEqual(28);
        expect(fadeBottom).toBeGreaterThanOrEqual(36);
        expect(fadeTop + fadeBottom).toBeLessThan(height * 0.35);
        expect(targets.length).toBeGreaterThan(0);
        const measurements = await auditContrast(
          page,
          info,
          `${cover}-${state}`,
          Object.fromEntries(
            targets.map(({ id, selector }) => [id, page.locator(selector)]),
          ),
          'clipped',
          band,
        );
        expect(measurements.some((row) => row.painted > 0)).toBe(true);
      } finally {
        await page.clock.resume();
      }
    }
  });
}
