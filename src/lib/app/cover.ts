import type { CoverCrop, CoverTokenResponse } from '#lib/api/cover.js';
import { COVER_INPUT_MAX_BYTES, COVER_SMALL_SIDE } from '#lib/api/cover.js';
import { endpoints } from '#lib/api/endpoints.js';

import type { DecodedImage, ImageCapability } from './browser';
import type { SessionApi, SessionFailure, SessionRound } from './session-round';

export type CoverProblem =
  | { kind: 'notImage' }
  | { kind: 'tooBig' }
  | { kind: 'heic' }
  | { kind: 'unreadable' };

export type CoverStep = 'token' | 'upload' | 'set';

export type CoverFailure =
  | SessionFailure
  | { kind: 'uploadFailed' }
  | { kind: 'exportFailed' };

export interface CoverUpload {
  step: CoverStep | null;
  imgId: string | null;
  failure: CoverFailure | null;
}

// 坐标和尺寸是工作位图上的像素
interface CoverCropped {
  playlistId: number;
  image: DecodedImage;
  small: boolean;
}

export type CoverState =
  | { status: 'picking'; playlistId: number }
  | { status: 'unusable'; playlistId: number; problem: CoverProblem }
  | ({ status: 'cropping' } & CoverCropped)
  | ({ status: 'uploading' } & CoverCropped & {
        upload: CoverUpload & { failure: null };
      })
  | ({ status: 'failed' } & CoverCropped & {
        upload: CoverUpload & { failure: CoverFailure };
      })
  // 刚设完读详情有时还是旧的，用设为封面返回的 url；网易云没给时是 null
  | { status: 'done'; playlistId: number; coverUrl: string | null };

export type CoverOutcome =
  | { ok: true; coverUrl: string | null }
  | { ok: false; step: CoverStep | null; failure: CoverFailure };

export interface CoverContext {
  api: SessionApi;
  session: SessionRound;
  images: ImageCapability;
  upload: (
    url: string,
    jpeg: Blob,
    token: string,
    signal: AbortSignal,
  ) => Promise<void>;
  write: (state: CoverState | null) => void;
  changed: (playlistId: number, coverUrl: string) => Promise<void>;
}

export interface PlaylistCoverEditor {
  prepare: (playlistId: number, file: File) => Promise<void>;
  upload: (crop: CoverCrop) => Promise<CoverOutcome | null>;
  cancel: () => void;
  retry: () => Promise<CoverOutcome | null>;
  close: () => void;
}

interface Attempt {
  playlistId: number;
  image: DecodedImage;
  small: boolean;
  crop: CoverCrop;
  jpeg: Blob | null;
  token: CoverTokenResponse | null;
  imgId: string | null;
  uploaded: boolean;
  controller: AbortController;
  canceled: boolean;
  running: boolean;
}

const looksHeic = (file: File): boolean =>
  /^image\/hei[cf]/i.test(file.type) || /\.(?:heic|heif)$/i.test(file.name);

export const createCover = (context: CoverContext): PlaylistCoverEditor => {
  const { images } = context;
  let state: CoverState | null = null;
  let attempt: Attempt | null = null;
  let decoding: object | null = null;

  const write = (next: CoverState | null): void => {
    state = next;
    context.write(next);
  };

  const cropped = (work: Attempt): CoverCropped => ({
    playlistId: work.playlistId,
    image: work.image,
    small: work.small,
  });

  const uploading = (
    step: CoverStep | null,
    failure: CoverFailure | null = null,
  ): void => {
    const work = attempt;
    if (!work) return;
    const next: CoverUpload = {
      step,
      imgId: work.uploaded ? work.imgId : null,
      failure,
    };
    if (failure) {
      write({
        status: 'failed',
        ...cropped(work),
        upload: { ...next, failure },
      });
    } else {
      write({
        status: 'uploading',
        ...cropped(work),
        upload: { ...next, failure: null },
      });
    }
  };

  const stale = (work: Attempt): boolean => work.canceled || attempt !== work;

  const release = (): void => {
    if (attempt) images.release(attempt.image);
    attempt = null;
  };

  const abandon = (): void => {
    decoding = null;
    attempt?.controller.abort();
    release();
  };

  const failed = (
    step: CoverStep | null,
    failure: CoverFailure,
  ): CoverOutcome | null => {
    if (!attempt) return null;
    uploading(step, failure);
    return { ok: false, step, failure };
  };

  const decode = async (playlistId: number, file: File): Promise<void> => {
    const mine = {};
    decoding = mine;
    write({ status: 'picking', playlistId });
    if (file.size > COVER_INPUT_MAX_BYTES) {
      if (decoding === mine) {
        write({
          status: 'unusable',
          playlistId,
          problem: { kind: 'tooBig' },
        });
      }
      return;
    }
    let image: DecodedImage;
    try {
      image = await images.decode(file);
    } catch {
      if (decoding !== mine) return;
      const problem: CoverProblem = looksHeic(file)
        ? { kind: 'heic' }
        : !file.type || !file.type.startsWith('image/')
          ? { kind: 'notImage' }
          : { kind: 'unreadable' };
      write({ status: 'unusable', playlistId, problem });
      return;
    }
    if (decoding !== mine) {
      images.release(image);
      return;
    }
    decoding = null;
    attempt = {
      playlistId,
      image,
      small: Math.min(image.origWidth, image.origHeight) < COVER_SMALL_SIDE,
      crop: { x: 0, y: 0, size: 1 },
      jpeg: null,
      token: null,
      imgId: null,
      uploaded: false,
      controller: new AbortController(),
      canceled: false,
      running: false,
    };
    write({
      status: 'cropping',
      ...cropped(attempt),
    });
  };

  const exportJpeg = async (work: Attempt): Promise<boolean> => {
    if (work.jpeg) return true;
    try {
      const blob = await images.exportJpeg(work.image, work.crop);
      if (!work.canceled) work.jpeg = blob;
      return true;
    } catch {
      return false;
    }
  };

  const run = async (from: CoverStep): Promise<CoverOutcome | null> => {
    const work = attempt;
    if (!work || work.running) return null;
    work.running = true;
    work.canceled = false;
    work.controller = new AbortController();
    let step = from;
    try {
      if (step !== 'set') {
        if (!work.jpeg && !(await exportJpeg(work))) {
          if (stale(work)) return null;
          return failed(null, { kind: 'exportFailed' });
        }
        if (stale(work)) return null;
      }
      if (step === 'token') {
        uploading('token');
        const result = await context.api.post(endpoints.coverToken, {
          id: work.playlistId,
        });
        if (!result || stale(work)) return null;
        if (!result.ok) return failed('token', result.failure);
        work.token = result.value;
        work.imgId = result.value.imgId;
        step = 'upload';
      }
      if (step === 'upload') {
        uploading('upload');
        try {
          await context.upload(
            work.token!.uploadUrl,
            work.jpeg!,
            work.token!.token,
            work.controller.signal,
          );
        } catch {
          if (stale(work)) return null;
          return failed('upload', { kind: 'uploadFailed' });
        }
        if (stale(work)) return null;
        work.uploaded = true;
        step = 'set';
      }
      uploading('set');
      // 设为封面不检查图片有没有传上去：网易云照样回 200，封面是坏的，所以必须等直传成功
      const result = await context.api.post(
        endpoints.setCover,
        { id: work.playlistId },
        { imgId: work.imgId! },
      );
      if (!result || stale(work)) return null;
      if (!result.ok) return failed('set', result.failure);
      const coverUrl = result.value.url;
      if (coverUrl !== null) await context.changed(work.playlistId, coverUrl);
      if (stale(work)) return null;
      images.release(work.image);
      attempt = null;
      write({ status: 'done', playlistId: work.playlistId, coverUrl });
      return { ok: true, coverUrl };
    } finally {
      work.running = false;
    }
  };

  const leave = (): void => {
    abandon();
    write(null);
  };

  context.session.onChange((change) => {
    if (change.kind !== 'signedIn') leave();
  });

  return {
    async prepare(playlistId, file) {
      if (state?.status === 'uploading' && state.upload.step === 'set') return;
      abandon();
      await decode(playlistId, file);
    },
    async upload(crop) {
      if (!attempt || state?.status !== 'cropping' || attempt.running)
        return null;
      if (
        attempt.crop.x !== crop.x ||
        attempt.crop.y !== crop.y ||
        attempt.crop.size !== crop.size
      )
        attempt.jpeg = null;
      attempt.crop = crop;
      return run('token');
    },
    cancel() {
      if (!attempt || state?.status !== 'uploading') return;
      if (state.upload.step === 'set') return;
      const old = attempt;
      old.canceled = true;
      old.controller.abort();
      attempt = {
        ...old,
        token: null,
        imgId: null,
        controller: new AbortController(),
        canceled: false,
        running: false,
      };
      write({
        status: 'cropping',
        ...cropped(attempt),
      });
    },
    async retry() {
      if (!attempt || state?.status !== 'failed') return null;
      return run(attempt.uploaded ? 'set' : 'token');
    },
    close() {
      if (state?.status === 'uploading' && state.upload.step === 'set') return;
      abandon();
      write(null);
    },
  };
};
