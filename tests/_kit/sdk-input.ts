import { field } from './mock/fixture-format.ts';

export const inputs: Record<string, readonly string[]> = {
  album: ['id'],
  album_sub: ['id', 't'],
  album_sublist: [],
  artist_album: ['id'],
  artist_desc: ['id'],
  artist_songs: ['id'],
  artist_sub: ['id', 't'],
  artist_sublist: [],
  captcha_sent: ['phone', 'ctcode'],
  cloudsearch: ['keywords', 'type'],
  image_upload_token: [],
  like: ['id', 'like'],
  likelist: ['uid'],
  login_cellphone: ['phone', 'captcha'],
  login_qr_check: ['key'],
  login_qr_create: ['key'],
  login_qr_key: [],
  login_refresh: [],
  logout: [],
  lyric_new: ['id'],
  playlist_catlist: [],
  playlist_cover_update: ['id', 'imgId'],
  playlist_create: ['name', 'privacy'],
  playlist_delete: ['id'],
  playlist_desc_update: ['id', 'desc'],
  playlist_detail: ['id'],
  playlist_name_update: ['id', 'name'],
  playlist_order_update: ['ids'],
  playlist_privacy: ['id'],
  playlist_subscribe: ['id', 't'],
  playlist_tags_update: ['id', 'tags'],
  playlist_tracks: ['op', 'pid', 'tracks'],
  recommend_songs: [],
  scrobble: ['id', 'time'],
  search_suggest: ['keywords'],
  song_detail: ['ids'],
  song_download_url_v1: ['id', 'level'],
  song_order_update: ['pid', 'ids'],
  song_url_v1: ['ids', 'level'],
  user_account: [],
  user_playlist: ['uid'],
  verify_getQr: ['vid', 'type', 'token', 'sign'],
};

// 这里只检查 Campanula 的业务输入；历史录制的字符串表示在匹配处单独转换。
export const validateQuery = (
  module: string,
  query: unknown,
  scenario: string,
): void => {
  const required = inputs[module];
  if (!required)
    throw new Error(`${scenario} / ${module}：未声明消费者查询合同`);
  const failures = required.filter((key) => field(query, key) === undefined);
  for (const key of ['id', 'pid', 'uid', 'offset', 'limit']) {
    const value = field(query, key);
    if (
      value !== undefined &&
      (typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < (key === 'offset' ? 0 : 1))
    )
      failures.push(key);
  }
  for (const key of ['ids', 'tracks']) {
    const value = field(query, key);
    if (
      value !== undefined &&
      (!Array.isArray(value) ||
        value.some(
          (id) =>
            typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0,
        ))
    )
      failures.push(key);
  }
  for (const key of [
    'name',
    'desc',
    'keywords',
    'key',
    'imgId',
    'phone',
    'captcha',
    'level',
  ]) {
    const value = field(query, key);
    if (value !== undefined && typeof value !== 'string') failures.push(key);
  }
  if (
    field(query, 'like') !== undefined &&
    typeof field(query, 'like') !== 'boolean'
  )
    failures.push('like');
  const op = field(query, 'op');
  if (op !== undefined && op !== 'add' && op !== 'del') failures.push('op');
  const order = field(query, 'order');
  if (order !== undefined && order !== 'hot' && order !== 'time')
    failures.push('order');
  const step = field(query, 'step');
  if (step !== undefined && step !== 'initial' && step !== 'fallback')
    failures.push('step');
  if (failures.length)
    throw new Error(
      `${scenario} / ${module}：期望关键输入 ${failures.join(', ')}，实际 ${JSON.stringify(query)}`,
    );
};
