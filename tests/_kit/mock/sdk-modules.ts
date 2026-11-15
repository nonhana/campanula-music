import type {
  ModuleCallConfig,
  ModuleIdentifier,
  ModuleQueryOf,
  ModuleResponseOf,
  NcmApiResponse,
} from 'hana-music-api';

type Invoke = (
  module: string,
  query: Record<string, unknown>,
  config?: ModuleCallConfig,
) => Promise<NcmApiResponse<unknown>>;

export const sdkModules = (invoke: Invoke) => {
  const bind =
    <K extends ModuleIdentifier>(module: K) =>
    (
      query: ModuleQueryOf<K>,
      config?: ModuleCallConfig,
    ): Promise<ModuleResponseOf<K>> =>
      invoke(module, query, config) as Promise<ModuleResponseOf<K>>;
  return {
    album: bind('album'),
    albumSub: bind('album_sub'),
    albumSublist: bind('album_sublist'),
    artistAlbum: bind('artist_album'),
    artistDesc: bind('artist_desc'),
    artistSongs: bind('artist_songs'),
    artistSub: bind('artist_sub'),
    artistSublist: bind('artist_sublist'),
    captchaSent: bind('captcha_sent'),
    cloudsearch: bind('cloudsearch'),
    imageUploadToken: bind('image_upload_token'),
    like: bind('like'),
    likelist: bind('likelist'),
    loginCellphone: bind('login_cellphone'),
    loginQrCheck: bind('login_qr_check'),
    loginQrCreate: bind('login_qr_create'),
    loginQrKey: bind('login_qr_key'),
    loginRefresh: bind('login_refresh'),
    logout: bind('logout'),
    lyricNew: bind('lyric_new'),
    playlistCatlist: bind('playlist_catlist'),
    playlistCoverUpdate: bind('playlist_cover_update'),
    playlistCreate: bind('playlist_create'),
    playlistDelete: bind('playlist_delete'),
    playlistDescUpdate: bind('playlist_desc_update'),
    playlistDetail: bind('playlist_detail'),
    playlistNameUpdate: bind('playlist_name_update'),
    playlistOrderUpdate: bind('playlist_order_update'),
    playlistPrivacy: bind('playlist_privacy'),
    playlistSubscribe: bind('playlist_subscribe'),
    playlistTagsUpdate: bind('playlist_tags_update'),
    playlistTracks: bind('playlist_tracks'),
    recommendSongs: bind('recommend_songs'),
    scrobble: bind('scrobble'),
    searchSuggest: bind('search_suggest'),
    songDetail: bind('song_detail'),
    songDownloadUrlV1: bind('song_download_url_v1'),
    songOrderUpdate: bind('song_order_update'),
    songUrlV1: bind('song_url_v1'),
    userAccount: bind('user_account'),
    userPlaylist: bind('user_playlist'),
    verifyGetQr: bind('verify_getQr'),
  };
};
