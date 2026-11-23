import { describe, expect, it, vi } from 'vitest';

import type { Song } from '#lib/api/library.ts';
import { connectMediaSession } from '#lib/app/media-session.ts';
import type { Player, PlayerState } from '#lib/app/player.ts';
import { INITIAL_PLAYER } from '#lib/app/player.ts';

import { FakeMediaMetadata, FakeMediaSession } from '../_kit/browser.ts';

const songWithDuration = (duration: number | null): Song => ({
  id: 101,
  name: '测试曲目',
  artists: [{ id: 1, name: '测试歌手' }],
  album: { id: 2, name: '测试专辑', coverUrl: null },
  duration,
  downloadSize: null,
  availability: 'full',
  trackNumber: null,
  disc: null,
  aliases: [],
  translations: [],
  publishedAt: null,
});

const playerState = (overrides: Partial<PlayerState>): PlayerState => ({
  ...INITIAL_PLAYER,
  queue: [{ song: songWithDuration(180_000), source: { kind: 'daily' } }],
  current: 0,
  status: 'playing',
  position: 10,
  duration: 180,
  volume: 1,
  ...overrides,
});

describe('media-session', () => {
  it('异常时长清空系统进度不抛错，负进度钳位到 0，stop 仅在非暂停态触发暂停', () => {
    const session = new FakeMediaSession();
    const toggle = vi.fn();
    let current = playerState({});

    const sync = connectMediaSession({
      session,
      MediaMetadata: FakeMediaMetadata,
      clock: { now: () => 0, after: () => () => {} },
      player: {
        toggle,
        previous: vi.fn(),
        next: vi.fn(),
        seek: vi.fn(),
      } as unknown as Player,
      read: () => current,
      localCover: () => null,
    });

    sync(current);
    expect(session.position).toEqual({
      duration: 180,
      position: 10,
      playbackRate: 1,
    });

    for (const badDuration of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      current = playerState({ duration: badDuration });
      expect(() => sync(current)).not.toThrow();
      expect(session.position).toBeNull();
    }

    current = playerState({ duration: 120, position: -3 });
    sync(current);
    expect(session.position).toEqual({
      duration: 120,
      position: 0,
      playbackRate: 1,
    });

    session.press('stop');
    expect(toggle).toHaveBeenCalledTimes(1);

    current = playerState({ status: 'paused' });
    session.press('stop');
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
