import { tick, untrack } from 'svelte';

import type { Song } from '#lib/api/library.js';
import type { App } from '#lib/app/app.js';

import type { DialogRequest } from '../overlay/overlay-requests';
import type { OverlayLayer, OverlayResult } from '../overlay/overlay-stack';
import type { SelectionAction } from './selection-actions.svelte';
import type { Checked } from './selection-core';
import {
  allOn as allVisibleOn,
  extend,
  NONE,
  picked as pickedSongs,
  selectAll as selectAllVisible,
  toggle as toggleChecked,
} from './selection-core';

export interface SelectionSource {
  readonly key: string;
  readonly songs: () => readonly Song[];
  readonly visible: () => readonly number[];
  readonly actions: readonly SelectionAction[];
  readonly present: () => boolean;
  readonly focusFirst: () => void;
}

export class MultiSelect {
  private readonly layer: OverlayLayer<DialogRequest, HTMLElement>;
  private readonly app: App;

  constructor(layer: OverlayLayer<DialogRequest, HTMLElement>, app: App) {
    this.layer = layer;
    this.app = app;
  }

  mode = $state(false);
  private checked = $state.raw<Checked>(NONE);
  private source = $state.raw<SelectionSource | null>(null);
  private entered: string | null = null;
  private watching: (() => void) | null = null;
  // 入口按钮会被工具条换掉，拿到的是重新找到它的回调
  private returnFocus: (() => HTMLElement | null) | null = null;

  get size(): number {
    return this.checked.ids.size;
  }

  get allOn(): boolean {
    return allVisibleOn(this.checked, this.source?.visible() ?? []);
  }

  get actions(): readonly SelectionAction[] {
    return this.source?.actions ?? [];
  }

  readonly picked = $derived.by(() => {
    const source = this.source;
    return source ? pickedSongs(source.songs(), this.checked.ids) : [];
  });

  has(id: number): boolean {
    return this.checked.ids.has(id);
  }

  returnTarget(): HTMLElement | null {
    const target = this.returnFocus?.() ?? null;
    // 每层关闭只问一次，拿到就清掉
    this.returnFocus = null;
    return target;
  }

  attach(source: SelectionSource): void {
    this.watching?.();
    this.source = source;
    if (this.mode && this.entered !== source.key) this.exit();
    this.watching = $effect.root(() => {
      $effect(() => {
        const id = source.key;
        const present = source.present();
        untrack(() => {
          if (this.mode && (id !== this.entered || !present)) this.exit();
        });
      });
    });
  }

  detach(source: SelectionSource): void {
    if (this.source !== source) return;
    this.watching?.();
    this.watching = null;
    this.source = null;
    if (this.mode) this.exit();
  }

  enter({
    id,
    from = null,
    focusFirst = false,
    focusEntry,
  }: {
    id?: number;
    from?: HTMLElement | null;
    focusFirst?: boolean;
    focusEntry?: () => HTMLElement | null;
  } = {}): void {
    const source = this.source;
    if (!source || !source.present() || this.mode) return;
    this.checked = id === undefined ? NONE : toggleChecked(NONE, id);
    this.returnFocus = focusEntry ?? null;
    this.entered = source.key;
    this.mode = true;
    void this.layer.open({ from }).then(
      (result) => {
        // 历史正好在动、会话刚换代时 open 会被取消或作废：别留下一个没有层的多选
        if (result !== 'committed') this.clear();
      },
      (error: unknown) => {
        // open 抛错（历史结果 failed 时核心会 reject）：没开成，先复位再报出来
        this.clear();
        console.error('进入多选失败', error);
      },
    );
    if (focusFirst) {
      void tick().then(() => {
        if (this.mode && this.source === source) source.focusFirst();
      });
    }
  }

  leave = (): Promise<OverlayResult> => this.layer.closeThrough();

  toggle(id: number): void {
    if (!this.mode) return;
    this.checked = toggleChecked(this.checked, id);
  }

  range(to: number): void {
    if (!this.mode) return;
    this.checked = extend(this.checked, this.source?.visible() ?? [], to);
  }

  selectAll(): void {
    if (!this.mode) return;
    this.checked = selectAllVisible(this.checked, this.source?.visible() ?? []);
  }

  async addTo(playlistId: number, songs: readonly Song[]): Promise<void> {
    const result = await this.leave();
    if (result === 'committed')
      await this.app.addSongsToPlaylist(playlistId, songs);
  }

  async deleteDownloads(songs: readonly Song[]): Promise<void> {
    const result = await this.leave();
    if (result === 'committed')
      await this.app.deleteDownloads(songs.map((song) => song.id));
  }

  clear(): void {
    this.mode = false;
    this.checked = NONE;
    this.entered = null;
  }

  private exit(): void {
    this.returnFocus = null;
    this.clear();
    void this.layer.invalidate();
  }
}
