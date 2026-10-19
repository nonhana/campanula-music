// 换歌单封面（#34）：选图、裁剪、三步上传。服务端只负责申请上传凭证和设为封面；
// 图片本身由浏览器直传网易云的图片存储（Spec #11“架构”）。

/** 选图的上限：超过就不读，提示换一张（原型定的；网易云本身不检查封面尺寸，验证关卡②） */
export const COVER_INPUT_MAX_BYTES = 20 * 1024 * 1024
/** 工作用的位图长边最多这么大：超过先缩小再裁（原型 194ms 缩完 8000×6000，验证关卡②） */
export const COVER_WORK_MAX_SIDE = 3200
/** 导出的正方形 JPEG 的边长（原型数值，验证关卡②实测网易云不检查尺寸，不用改） */
export const COVER_OUTPUT_SIZE = 800
/** 导出的 JPEG 起始质量；超过 COVER_OUTPUT_MAX_BYTES 就降质量重压 */
export const COVER_OUTPUT_QUALITY = 0.88
export const COVER_OUTPUT_MAX_BYTES = 1024 * 1024
export const COVER_OUTPUT_MIN_QUALITY = 0.6
/** 原图短边小于这个数，提示放大成封面可能会糊（网易云不放大缩略图，验证关卡②） */
export const COVER_SMALL_SIDE = 300

/** 正方形取景框在（缩小后的）工作位图上的位置，单位是这张位图的像素 */
export interface CoverCrop {
  x: number
  y: number
  size: number
}

/**
 * POST /api/playlists/[id]/cover/token：申请上传凭证。imgId 是这张图在网易云的编号，token 直传时放进 x-nos-token，
 * uploadUrl 是图片存储的地址（跨域）。token 是凭据，服务端只透传、不记日志（ADR-0003）
 */
export interface CoverTokenResponse {
  imgId: string
  token: string
  uploadUrl: string
}

/** POST /api/playlists/[id]/cover：把已经直传成功的图片设为封面。没有直传成功就设，网易云也回 200，封面会坏（验证关卡②） */
export interface SetCoverRequest {
  imgId: string
}

/** 设好了：用这个地址显示新封面，刚设完马上读歌单详情有时还是旧的（验证关卡②） */
export interface SetCoverResponse {
  url: string
}
