export const COVER_INPUT_MAX_BYTES = 20 * 1024 * 1024;
export const COVER_WORK_MAX_SIDE = 3200;
export const COVER_OUTPUT_SIZE = 800;
export const COVER_OUTPUT_QUALITY = 0.88;
export const COVER_OUTPUT_MAX_BYTES = 1024 * 1024;
export const COVER_OUTPUT_MIN_QUALITY = 0.6;
export const COVER_SMALL_SIDE = 300;

export interface CoverCrop {
  x: number;
  y: number;
  size: number;
}

// uploadUrl 是图片存储地址（跨域）；token 是凭据，服务端只透传、不记日志
export interface CoverTokenResponse {
  imgId: string;
  token: string;
  uploadUrl: string;
}

// 直传没成功时设也回 200，封面会坏
export interface SetCoverRequest {
  imgId: string;
}

export interface SetCoverResponse {
  url: string | null;
}
