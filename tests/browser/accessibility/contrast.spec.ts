import { measureContrast } from '../../tools/browser/contrast.ts';
import { expect, test } from '../fixture.ts';

test('渲染对比度测量区分合格、同色、半透明和遮罩', async ({ page }, info) => {
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>
    body { margin:0;background:white;font:24px/40px Arial; }
    p { margin:0; }
    #black { color:black; }
    #gray { color:#777; }
    #same { color:white; }
    #alpha { color:rgba(0,0,0,.5); }
    #mask { color:black;mask-image:linear-gradient(#0008,#0008); }
    #gradient { color:black;background:linear-gradient(white,#ddd); }
    #image { color:black;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Cpath fill='%23ddd' d='M0 0h10v10H0z'/%3E%3C/svg%3E"); }
    #thin { color:#6b7280;font:13px/20px Arial; }
    #opacity { color:black;opacity:.5; }
    #mixed { color:black;opacity:.5;mask-image:linear-gradient(#0008,#0008); }
    #hidden { color:black;opacity:0; }
  </style><p id="black">Contrast control</p><p id="gray">Contrast control</p><p id="same">Contrast control</p><p id="alpha">Contrast control</p><p id="mask">Contrast control</p><p id="gradient">Contrast control</p><p id="image">Contrast control</p><p id="thin">3</p><p id="opacity">Contrast control</p><p id="mixed">Contrast control</p><p id="hidden">Contrast control</p>`);
  await page.evaluate(async () => {
    const image = new Image();
    image.src = getComputedStyle(
      document.querySelector('#image')!,
    ).backgroundImage.slice(5, -2);
    await image.decode();
  });
  const result = await measureContrast(page, [
    '#black',
    '#gray',
    '#same',
    '#alpha',
    '#mask',
    '#gradient',
    '#image',
    '#thin',
    '#opacity',
    '#mixed',
    '#hidden',
  ]);
  await info.attach('contrast-calibration', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
  const minimum = (selector: string) =>
    result.find((row) => row.selector === selector)!.minimum!;
  expect(minimum('#black')).toBeCloseTo(21, 1);
  expect(minimum('#gray')).toBeLessThan(4.5);
  expect(minimum('#gray')).toBeGreaterThan(4.3);
  expect(minimum('#same')).toBe(1);
  expect(minimum('#alpha')).toBeGreaterThan(3.9);
  expect(minimum('#alpha')).toBeLessThan(4.1);
  expect(minimum('#mask')).toBeGreaterThan(4.3);
  expect(minimum('#mask')).toBeLessThan(4.5);
  expect(minimum('#opacity')).toBeGreaterThan(3.9);
  expect(minimum('#opacity')).toBeLessThan(4.1);
  expect(minimum('#mixed')).toBeGreaterThan(1.8);
  expect(minimum('#mixed')).toBeLessThan(2.1);
  expect(minimum('#gradient')).toBeGreaterThan(15);
  expect(minimum('#image')).toBeCloseTo(15.46, 1);
  expect(minimum('#thin')).toBeGreaterThan(4.7);
  expect(minimum('#thin')).toBeLessThan(4.9);
  expect(result.find((row) => row.selector === '#hidden')!.painted).toBe(0);
  expect(result.find((row) => row.selector === '#hidden')!.minimum).toBeNull();
  await expect(page.locator('[data-contrast-text]')).toHaveCount(0);
});

test('采样期间文字移动时明确失败并清理探针', async ({ page }) => {
  await page.setContent(
    `<meta name="viewport" content="width=device-width, initial-scale=1"><p id="moving" style="position:relative;color:black;font:24px Arial">Moving contrast control</p>`,
  );
  await page.evaluate(() => {
    const text = document.querySelector<HTMLElement>('#moving')!;
    let offset = 0;
    setInterval(() => {
      text.style.left = `${++offset}px`;
    }, 10);
  });
  await expect(measureContrast(page, ['#moving'])).rejects.toThrow(
    'text moved during contrast capture',
  );
  await expect(page.locator('[data-contrast-text]')).toHaveCount(0);
});

test('带垂直渐隐的遮罩放开边缘后仍严格校验主体纵带', async ({ page }) => {
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>
    body { margin:0;background:white;font:24px/30px Arial; }
    p { margin:0; }
    .masked {
      height:90px;
      mask-image:linear-gradient(180deg, transparent 0, #000 30px, #000 60px, transparent 90px);
    }
    #pass { color:black; }
    #fail { color:#777; }
  </style><div class="masked"><p id="pass">Top edge<br>Middle body<br>Bottom edge</p></div><div class="masked"><p id="fail">Top edge<br>Middle body<br>Bottom edge</p></div>`);
  const bandOf = async (selector: string) =>
    page.locator(selector).evaluate((el) => {
      const rect = el.closest('.masked')!.getBoundingClientRect();
      return { top: rect.top + 31, bottom: rect.top + 59 };
    });
  const unbanded = await measureContrast(page, ['#pass']);
  expect(unbanded[0].minimum!).toBeLessThan(4.5);
  const bandedPass = await measureContrast(
    page,
    ['#pass'],
    await bandOf('#pass'),
  );
  expect(bandedPass[0].painted).toBeGreaterThan(0);
  expect(bandedPass[0].minimum!).toBeGreaterThanOrEqual(4.5);
  const bandedFail = await measureContrast(
    page,
    ['#fail'],
    await bandOf('#fail'),
  );
  expect(bandedFail[0].painted).toBeGreaterThan(0);
  expect(bandedFail[0].minimum!).toBeLessThan(4.5);
});
