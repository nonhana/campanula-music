import type { CoverCrop } from '#lib/api/cover.js';

import { clamp } from '../shared/clamp';

export interface CropFrame {
  width: number;
  height: number;
  size: number;
}

// zoom 是相对“短边铺满”的倍数，x / y 是左上角相对框的位移（px）
export interface CropView {
  zoom: number;
  x: number;
  y: number;
}

export interface CropPoint {
  x: number;
  y: number;
}

export const maxZoomOf = ({ width, height }: CropFrame): number =>
  Math.max(1, Math.min(6, Math.min(width, height) / 160));

const baseScaleOf = ({ width, height, size }: CropFrame): number =>
  size / Math.min(width, height);

export const centerCrop = (width: number, height: number): CoverCrop => {
  const size = Math.min(width, height);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
};

export const createCropView = (frame: CropFrame, crop: CoverCrop): CropView => {
  const base = baseScaleOf(frame);
  const zoom = clamp(
    crop.size > 0 ? frame.size / crop.size / base : 1,
    1,
    maxZoomOf(frame),
  );
  return clamped(frame, {
    zoom,
    x: -crop.x * base * zoom,
    y: -crop.y * base * zoom,
  });
};

// 返回的 crop 是工作位图上的正方形，单位是那张位图的像素
export const cropOf = (frame: CropFrame, view: CropView): CoverCrop => {
  const scale = baseScaleOf(frame) * view.zoom;
  return {
    x: clean(-view.x / scale),
    y: clean(-view.y / scale),
    size: frame.size / scale,
  };
};

export const panCrop = (
  frame: CropFrame,
  view: CropView,
  dx: number,
  dy: number,
): CropView => clamped(frame, { ...view, x: view.x + dx, y: view.y + dy });

export const zoomTo = (
  frame: CropFrame,
  view: CropView,
  zoom: number,
  at: CropPoint = centerOf(frame),
): CropView => {
  const next = clamp(zoom, 1, maxZoomOf(frame));
  if (next === view.zoom) return view;
  const base = baseScaleOf(frame);
  const before = base * view.zoom;
  const after = base * next;
  return clamped(frame, {
    zoom: next,
    x: at.x - ((at.x - view.x) * after) / before,
    y: at.y - ((at.y - view.y) * after) / before,
  });
};

export const zoomBy = (
  frame: CropFrame,
  view: CropView,
  factor: number,
  at: CropPoint = centerOf(frame),
): CropView => zoomTo(frame, view, view.zoom * factor, at);

export const wheelCrop = (
  frame: CropFrame,
  view: CropView,
  deltaY: number,
  at: CropPoint,
): CropView => zoomTo(frame, view, view.zoom * Math.exp(-deltaY / 400), at);

export const nudgeCrop = (
  frame: CropFrame,
  view: CropView,
  key: string,
  shift: boolean,
): CropView | null => {
  const step = shift ? 40 : 10;
  switch (key) {
    case 'ArrowLeft':
      return panCrop(frame, view, step, 0);
    case 'ArrowRight':
      return panCrop(frame, view, -step, 0);
    case 'ArrowUp':
      return panCrop(frame, view, 0, step);
    case 'ArrowDown':
      return panCrop(frame, view, 0, -step);
    case '+':
    case '=':
      return zoomBy(frame, view, 1.15);
    case '-':
      return zoomBy(frame, view, 1 / 1.15);
    default:
      return null;
  }
};

export const pinchCrop = (
  frame: CropFrame,
  view: CropView,
  startZoom: number,
  startDistance: number,
  distance: number,
  at: CropPoint,
): CropView => {
  if (startDistance <= 0) return view;
  return zoomTo(frame, view, startZoom * (distance / startDistance), at);
};

const centerOf = (frame: CropFrame): CropPoint => ({
  x: frame.size / 2,
  y: frame.size / 2,
});

const clamped = (frame: CropFrame, view: CropView): CropView => {
  const zoom = clamp(view.zoom, 1, maxZoomOf(frame));
  const scale = baseScaleOf(frame) * zoom;
  return {
    zoom,
    x: Math.min(0, Math.max(frame.size - frame.width * scale, view.x)),
    y: Math.min(0, Math.max(frame.size - frame.height * scale, view.y)),
  };
};

const clean = (value: number): number => (value === 0 ? 0 : value);
