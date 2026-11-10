import { describe, expect, it } from 'vitest';

import type {
  DragScrollPose,
  DragScrollSpan,
  Glide,
} from '#lib/components/shared/drag-scroll-core.js';
import {
  createDragScrollCore,
  frictionGlide,
  glideEnd,
  glideTolerance,
  springGlide,
} from '#lib/components/shared/drag-scroll-core.js';
import type { PointerSample } from '#lib/components/shared/press.js';

const setup = (
  span: DragScrollSpan | null = { position: 200, max: 1000, stopped: false },
) => {
  const poses: DragScrollPose[] = [];
  const core = createDragScrollCore({
    begin: () => span,
    onPose: (pose) => poses.push(pose),
  });

  let time = 0;
  const sample = (
    x: number,
    y: number,
    buttons: number,
    extra: Partial<PointerSample> = {},
  ): PointerSample => ({
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons,
    x,
    y,
    time,
    ...extra,
  });
  const pointer = {
    down(x: number, extra?: Partial<PointerSample>) {
      return core.press(sample(x, 300, 1, extra));
    },
    move(x: number, ms = 16, y = 300, extra?: Partial<PointerSample>) {
      time += ms;
      core.move(sample(x, y, 1, extra));
    },
    up(x: number, ms = 16) {
      time += ms;
      core.release(sample(x, 300, 0));
    },
    // 鼠标的 detail 是 1，键盘的是 0；返回 true 是吞掉了
    click(detail = 1) {
      return core.click(detail);
    },
  };
  return { core, pointer, poses };
};

const trace = (glide: Glide): number[] => {
  const points: number[] = [];
  for (let t = 0; t <= 5; t += 1 / 120) {
    points.push(glide.at(t));
    if (glide.done(t)) return points;
  }
  throw new Error('5 秒还没停');
};

const tolerance = glideTolerance(2);

describe('跟手和点按', () => {
  it('鼠标挪过 5px 才开始拖，之后滚动位置是按下时的位置减去横着挪过的距离；没挪够就松开是点按，跟着的 click 照常', () => {
    const { core, pointer } = setup();

    pointer.down(300);
    pointer.move(304);
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
    pointer.up(304);
    expect(pointer.click()).toBe(false);

    pointer.down(300);
    pointer.move(303, 16, 304);
    expect(core.pose).toEqual({ dragging: true, position: 197 });
    pointer.move(250);
    expect(core.pose).toEqual({ dragging: true, position: 250 });
    pointer.move(400);
    expect(core.pose).toEqual({ dragging: true, position: 100 });
    pointer.up(400, 500);
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
    expect(pointer.click()).toBe(true);
  });

  it('拖到头就停在头上，往回拖立刻跟手，不用先把拖过头的那段拖回来', () => {
    const { core, pointer } = setup({ position: 20, max: 100, stopped: false });
    pointer.down(300);
    pointer.move(350);
    expect(core.pose).toEqual({ dragging: true, position: 0 });
    pointer.move(380);
    pointer.move(370);
    expect(core.pose).toEqual({ dragging: true, position: 10 });
    pointer.move(200);
    expect(core.pose).toEqual({ dragging: true, position: 100 });
    pointer.move(210);
    expect(core.pose).toEqual({ dragging: true, position: 90 });
  });

  it('拖过之后跟着的 click 不算点按，但键盘按出来的 click（Enter、空格）照常', () => {
    const { pointer } = setup();
    pointer.down(300);
    pointer.move(200);
    pointer.up(200, 500);
    expect(pointer.click(0)).toBe(false);
  });

  it('在 Mac 上快速松手：pointerup 之前先来一次主键已经松开（buttons 为 0）的移动，照常跟手、松手照常甩，跟着的 click 不算点按（不会打开松手处的专辑）', () => {
    const { core, pointer } = setup();
    pointer.down(500);
    pointer.move(490, 10);
    pointer.move(470, 10);
    pointer.move(440, 10, 300, { buttons: 0 });
    expect(core.pose).toEqual({ dragging: true, position: 260 });
    pointer.up(440, 0);
    expect(core.pose).toMatchObject({ dragging: false });
    expect(core.pose.dragging === false && core.pose.velocity).toBeGreaterThan(
      0,
    );
    expect(pointer.click()).toBe(true);
  });
});

describe('哪些按下才接', () => {
  it('只接鼠标主键的主指针：手指、笔照旧由浏览器滚，右键、第二根指针不接', () => {
    const { core, pointer } = setup();
    expect(pointer.down(300, { pointerType: 'touch' })).toBe(false);
    expect(pointer.down(300, { pointerType: 'pen' })).toBe(false);
    expect(pointer.down(300, { button: 2, buttons: 2 })).toBe(false);
    expect(pointer.down(300, { isPrimary: false })).toBe(false);
    pointer.move(100);
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
  });

  it('滚不动、按在自绘滚动条上（量出来是 null）：不接，拖了也不滚', () => {
    const { core, pointer } = setup(null);
    expect(pointer.down(300)).toBe(false);
    pointer.move(100);
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
  });

  it('按住了松手后还在滑的内容：没拖就松开只让它停，跟着的 click 不算点按，并报一次“停了”好让歌曲格对齐；平常没拖就松开什么都不报', () => {
    const stopping = setup({ position: 200, max: 1000, stopped: true });
    stopping.pointer.down(300);
    stopping.pointer.up(300);
    expect(stopping.poses).toEqual([{ dragging: false, velocity: 0 }]);
    expect(stopping.pointer.click()).toBe(true);

    const still = setup();
    still.pointer.down(300);
    still.pointer.up(300);
    expect(still.poses).toEqual([]);
    expect(still.pointer.click()).toBe(false);
  });
});

describe('松手速度（照 Flutter 的 macOS 滚动）', () => {
  it('最近三段相邻移动的速度按 0.15、0.65、0.2 相加，从旧到新：指针每秒往左 1000、2000、3000px，松手后往右滚每秒 2050px', () => {
    const { core, pointer } = setup({
      position: 200,
      max: 5000,
      stopped: false,
    });
    pointer.down(500);
    pointer.move(490, 10);
    pointer.move(470, 10);
    pointer.move(440, 10);
    pointer.up(440, 0);
    expect(core.pose.dragging).toBe(false);
    expect(core.pose.dragging === false && core.pose.velocity).toBeCloseTo(
      2050,
      6,
    );

    const right = setup({ position: 2000, max: 5000, stopped: false });
    right.pointer.down(500);
    right.pointer.move(510, 10);
    right.pointer.move(530, 10);
    right.pointer.move(560, 10);
    right.pointer.up(560, 0);
    expect(
      right.core.pose.dragging === false && right.core.pose.velocity,
    ).toBeCloseTo(-2050, 6);
  });

  it('最后一次移动到松手隔了 40ms 还算在动；隔了 40ms 以上算手已经停了，不甩，停在手底下', () => {
    const moving = setup({ position: 200, max: 5000, stopped: false });
    moving.pointer.down(500);
    moving.pointer.move(490, 10);
    moving.pointer.move(470, 10);
    moving.pointer.move(440, 10);
    moving.pointer.up(440, 40);
    expect(
      moving.core.pose.dragging === false && moving.core.pose.velocity,
    ).toBeCloseTo(2050, 6);

    const paused = setup({ position: 200, max: 5000, stopped: false });
    paused.pointer.down(500);
    paused.pointer.move(490, 10);
    paused.pointer.move(470, 10);
    paused.pointer.move(440, 10);
    paused.pointer.up(440, 41);
    expect(paused.core.pose).toEqual({ dragging: false, velocity: 0 });
  });

  it('不快过每秒 100px：不甩', () => {
    const { core, pointer } = setup();
    pointer.down(500);
    pointer.move(494, 60);
    pointer.move(489, 60);
    pointer.move(484, 60);
    pointer.up(484, 0);
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
  });
});

describe('作废', () => {
  it('拖着时又按下了右键：停在当前位置、不甩，之后的移动、松开都不管，跟着的 click 不算点按', () => {
    const { core, pointer } = setup();
    pointer.down(300);
    pointer.move(280);
    expect(core.pose).toEqual({ dragging: true, position: 220 });
    pointer.move(100, 16, 300, { buttons: 3 });
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
    pointer.move(50);
    pointer.up(50, 0);
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
    expect(pointer.click()).toBe(true);
  });

  it('拖着时被叫停（右键菜单、切走窗口、页面藏起来）：不甩；只叫停这根指针时别的指针不算', () => {
    const { core, pointer } = setup();
    pointer.down(500);
    pointer.move(400, 20);
    core.abandon(2);
    expect(core.pose).toEqual({ dragging: true, position: 300 });
    core.abandon(1);
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
    pointer.up(380, 0);
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
    expect(pointer.click()).toBe(true);

    pointer.down(500);
    pointer.move(400, 20);
    core.abandon();
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
  });

  it('上一次拖着没等到松开就又按下了：先停下上一次；新的这次照常是点按', () => {
    const { core, pointer } = setup();
    pointer.down(300);
    pointer.move(250, 20);
    pointer.down(200);
    expect(core.pose).toEqual({ dragging: false, velocity: 0 });
    pointer.up(200);
    expect(pointer.click()).toBe(false);
  });
});

describe('松手后的滑行', () => {
  it('没有吸附：从松手的位置、带着松手的速度起步，之后一路变慢直到停下，不会先停住再加速', () => {
    const glide = frictionGlide(200, 2000, 5000, tolerance);
    const points = trace(glide);
    expect(points[0]).toBe(200);
    const start = (glide.at(0.001) - glide.at(0)) / 0.001;
    expect(start).toBeGreaterThan(2000 * 0.99);
    expect(start).toBeLessThan(2000 * 1.01);
    const steps = points.slice(1).map((x, i) => x - points[i]!);
    for (let i = 1; i < steps.length; i++)
      expect(steps[i]).toBeLessThanOrEqual(steps[i - 1]! + 1e-9);
    expect(points.at(-1)).toBeGreaterThan(200);
    expect(glide.at(10)).toBe(points.at(-1));
  });

  it('没有吸附：往左也一样；滑到头就停在头上，不超出能滚的范围', () => {
    const left = trace(frictionGlide(800, -2000, 5000, tolerance));
    expect(left.at(-1)).toBeLessThan(800);

    const edge = frictionGlide(950, 3000, 1000, tolerance);
    const points = trace(edge);
    expect(Math.max(...points)).toBe(1000);
    expect(points.at(-1)).toBe(1000);
  });

  it('有吸附：带着松手的速度起步，停下时正好在浏览器挑的那一格上，路上不冲过那一格', () => {
    const target = 600;
    const glide = springGlide(200, target, 2000, tolerance);
    const points = trace(glide);
    expect(points[0]).toBe(200);
    const start = (glide.at(0.001) - glide.at(0)) / 0.001;
    expect(start).toBeGreaterThan(2000 * 0.99);
    expect(start).toBeLessThan(2000 * 1.01);
    expect(Math.max(...points)).toBeLessThanOrEqual(target);
    expect(points.at(-1)).toBe(target);

    const still = trace(springGlide(230, 204, 0, tolerance));
    expect(Math.min(...still)).toBeGreaterThanOrEqual(204);
    expect(still.at(-1)).toBe(204);
  });

  it('有吸附时先问没有吸附会停在哪：不甩就是原地；甩了是往速度那边去的某处，滑到头就是头', () => {
    expect(glideEnd(300, 0, 1000)).toBe(300);
    expect(glideEnd(300, 2000, 5000)).toBeGreaterThan(300);
    expect(glideEnd(300, -2000, 5000)).toBeLessThan(300);
    expect(glideEnd(950, 3000, 1000)).toBe(1000);
  });
});
