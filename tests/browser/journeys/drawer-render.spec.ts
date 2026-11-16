import { expect, login, test } from '../fixture.ts';

test.use({ channel: 'chromium' });

test('抽屉静止、起拖和松手沿用同一绘制层', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  let layers: {
    layerId: string;
    backendNodeId?: number;
    drawsContent: boolean;
  }[] = [];
  cdp.on('LayerTree.layerTreeDidChange', (event) => {
    layers = event.layers ?? [];
  });
  await cdp.send('DOM.enable');
  await login(page, '/playlists/900000024');
  await page
    .locator('main [data-song-id="3433267939"] [data-play-target]')
    .click();
  await page.getByRole('button', { name: /^打开播放页/ }).click();
  const player = page.getByRole('dialog', { name: '正在播放', exact: true });
  await player.getByRole('button', { name: '播放队列', exact: true }).click();
  const queue = page.getByRole('dialog', { name: '播放队列', exact: true });
  await expect
    .poll(() => queue.evaluate((el) => el.getBoundingClientRect().top))
    .toBeCloseTo(118.16, 1);
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '[role="dialog"][aria-label="播放队列"]',
  });
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  await cdp.send('LayerTree.enable');
  const capture = async () => {
    await page.screenshot();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const layer = layers.find(
      (layer) =>
        layer.backendNodeId === node.backendNodeId && layer.drawsContent,
    );
    if (!layer) return null;
    const reasons = await cdp.send('LayerTree.compositingReasons', {
      layerId: layer.layerId,
    });
    return {
      layerId: layer.layerId,
      reasons: reasons.compositingReasonIds.sort(),
    };
  };
  const before = await capture();
  const handle = queue.getByRole('button', {
    name: '收起播放队列',
    exact: true,
  });
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  let dragging;
  try {
    await page.mouse.move(x, y + 80);
    dragging = await capture();
    await handle.dispatchEvent('pointercancel', {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
    });
  } finally {
    await page.mouse.up();
  }
  const settled = await capture();
  await info.attach('drawer-render-layers', {
    body: JSON.stringify({ before, dragging, settled }),
    contentType: 'application/json',
  });
  await cdp.detach();
  expect(before).not.toBeNull();
  expect(dragging).toEqual(before);
  expect(settled).toEqual(before);
});
