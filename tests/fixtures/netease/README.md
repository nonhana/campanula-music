# 网易云真实返回（验证关卡①②录制）

来源：在 Vercel 上的一次性测试版（分支 `gate/vercel`）里录制，SDK 为 `hana-music-api@1.4.0`，登录态用作者的主账号（会员）。

- 验证关卡①（nonhana/campanula-music#14，2026-10-08）：`login/`、`library/`、`playback/`、`search/`。登录后的录制之外，其余是未登录（匿名）视角。
- 验证关卡②（nonhana/campanula-music#15，2026-10-09 北京时间）：`playlist-edit/`（歌单编辑：新建、删除、名称和简介、标签、隐私、封面、加歌和移除、排序、自建歌单之间排序）、`like-collect/`（红心、收藏和取消收藏）。歌单写操作只在临时新建、测完即删的歌单上做。

供 nonhana/hana-music-api#17–#22 的契约测试和 Campanula 自己的测试使用。自动化测试只读这些文件，不连真实账号（Spec #11“交付方式”第 3 条）。

## 使用前须知

- `playback/scrobble.json`：网易云回了 `{"code":200,"data":"success"}`，但这次打卡**没有计入**听歌排行（41 分钟后仍未变化，见 #14 留言）。它只代表“接口返回的样子”，不代表打卡有效。
- 扫码时要求行为验证的 8821 这次没有出现，没有录到。
- `login/login_cellphone.10004-risk.json` 是短信登录被风控拦下的真实返回；`login/captcha_sent.502-anonymous-registration.json` 是 SDK 1.4.0 匿名注册失败时的返回（报错原文里的“MUSIC_A”只是文字，不是凭据）。
- 首次同步时“我喜欢的音乐”的歌单详情原始返回约 3.1 MB、一次 1,000 首的歌曲信息约 2.1 MB；这里的文件只留了前 30 项，原长度见 `context.truncated`。
- `playlist-edit/playlist_tracks.*`：SDK 1.4.0 的 `playlist_tracks` 在网易云回 HTTP 200 时，把返回多包了一层：`response.body` 是 `{ status, body: { code, count, trackIds }, cookie }`，外层看不出成败，要看里面的 `body.code`（整批都已在歌单里时是 502“歌单内歌曲重复”）。网易云回 HTTP 错误时（比如歌单不存在的 404）`response.body` 是平的 `{ code, message }`。
- `playlist-edit/song_order_update.whole-4967-reversed.json`、`…whole-4967-shuffled.json`：一次改动几千首位置的排序，网易云约 3.3 秒后回 HTTP 400 / `-1`“请求异常，请稍后重试”，但新顺序其实已经生效（重新读歌单确认过）。只挪动几首时同样大小的请求 0.5 秒回 200（`…whole-4967-small-change.json`）。`…missing-one.json`（少提交一首、其余倒序）同样回 `-1`，2 秒后重读时新顺序还没有完全生效。
- `playlist-edit/playlist_detail.deleted.json`：已删除的歌单仍回 200 和完整歌单，只有 `playlist.status` 是 10（正常歌单是 0）。对已删除的歌单加歌、移除、排序回 404“歌单不存在”；改名称、简介、标签、封面和再删一次都回 200。
- `like-collect/playlist_subscribe.*`：验证关卡②里用 SDK 1.4.0 收藏歌单一律回 405“操作过于频繁，请稍后再试”：自己的、别人的歌单，eapi、weapi，默认伪装 IP、真实国内 IP，隔 20 分钟再试，都一样；同一时间作者在官方 App 里收藏、取消都正常，专辑、歌手、红心也都正常。所以这些文件代表的是 SDK 发的请求被拒的样子，不是收藏歌单成功的返回（见 #15 留言）。
- `playlist-edit/nos_upload.*` 不是 SDK 调用，是浏览器拿 `image_upload_token` 的凭证直传网易云图片存储（`nosup-hz1.127.net`）的返回：`query` 写图片的尺寸、字节数和 JPEG 质量。
- 两次录制分别脱敏，假编号不跨批次对应：比如两边的 `900000002` 不是同一张歌单。

## 文件格式

每个文件是一次 SDK 调用（`playlist-edit/nos_upload.*` 例外：它是浏览器直传网易云图片存储的返回，`context` 里没有 `sdk` 和 `ip`，`region` 是 `browser`）：

```jsonc
{
  "module": "song_url_v1", // SDK 模块名
  "query": { "id": 0, "level": "exhigh" },
  "context": {
    "recordedAt": "…", // 录制时间（UTC）
    "sdk": "hana-music-api@1.4.0",
    "region": "hkg1", // Vercel 函数地区
    "ip": "default", // default = SDK 默认伪装 IP；real = 传入真实国内 IP；none = 不带
    "viewer": "vip-qr", // anonymous / vip-qr（扫码登录）/ vip-sms（短信登录）
    "note": "…", // 可选
    "truncated": [{ "path": "body.songs", "length": 1000 }] // 可选：哪些数组被截短，原长度多少
  },
  "response": { "status": 200, "body": { } } // SDK 返回的 status 和 body，原样
}
```

## 脱敏（Spec #11“交付方式”第 5 条）

- 去掉 Cookie：返回体里的 `cookie`、`token`、`tokenJsonStr` 等凭据字段清空；SDK 返回的 Set-Cookie 不收录（各条 Cookie 的有效期见 #14 的留言）。
- 所有用户（账号本人、歌单创建者、歌词贡献者……）的 uid 字段换成 `10000001` 起的假编号，昵称字段换成“测试听众”“用户N”，头像和背景图换成占位链接。账号本人是 `10000001` / “测试听众”；只有本人的 uid 和昵称会在任意文字里替换（其他人的只换字段，避免误改同名的歌手名）。
- 账号资料里的个人信息（生日、地区、签名、注册时间、绑定信息、账号名里的手机号）换成固定假值；账号本人作为歌手的编号和名字换成 `99999999` / “测试歌手”。
- 本人自建歌单的编号换成 `900000001` 起，本人作品（歌、专辑）的编号换成 9 字头的假编号：这些编号公开可查，查到就能找到真实账号。其他歌单、歌、专辑、歌手的编号是真实的。
- 超过 30 项的数组只留前 30 项，原长度记在 `context.truncated`；查询参数里上千个编号的列表（加歌的 `tracks`、排序的 `ids`）同样只留前 30 个，记在 `context.truncated` 的 `query.*` 路径下。
- 上传凭证（`image_upload_token` 返回的 `token`）清空；图片编号和地址是测试时画的图，原样保留。
- 其余结构和取值原样保留。

## 清单

| 文件 | 模块 | 视角 | 地区 / IP | status | 截短 | 说明 |
|---|---|---|---|---|---|---|
| `library/album.json` | `album` | anonymous | hkg1 / default | 200 |  |  |
| `library/album_sublist.json` | `album_sublist` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/artist_album.json` | `artist_album` | anonymous | hkg1 / default | 200 |  |  |
| `library/artist_detail.json` | `artist_detail` | anonymous | hkg1 / default | 200 |  |  |
| `library/artist_sublist.json` | `artist_sublist` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/artist_sublist.page2.json` | `artist_sublist` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/artist_top_song.json` | `artist_top_song` | anonymous | hkg1 / default | 200 | 是 |  |
| `library/artists.json` | `artists` | anonymous | hkg1 / default | 200 | 是 |  |
| `library/likelist.json` | `likelist` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/playlist_detail.liked.json` | `playlist_detail` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/playlist_detail.own-small.json` | `playlist_detail` | vip-qr | hkg1 / default | 200 |  |  |
| `library/playlist_detail.subscribed.json` | `playlist_detail` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/playlist_track_all.json` | `playlist_track_all` | vip-qr | hkg1 / default | 200 |  |  |
| `library/recommend_songs.json` | `recommend_songs` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/song_detail.anon.json` | `song_detail` | anonymous | hkg1 / default | 200 |  |  |
| `library/song_detail.vip.json` | `song_detail` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/user_playlist.json` | `user_playlist` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/user_record.all.json` | `user_record` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/user_record.week.json` | `user_record` | vip-qr | hkg1 / default | 200 | 是 |  |
| `login/captcha_sent.502-anonymous-registration.json` | `captcha_sent` | anonymous | hkg1 / real | 502 |  | SDK 1.4.0 隐式匿名注册随机 deviceId 被拒（摘要含 + 或 /） |
| `login/captcha_sent.json` | `captcha_sent` | anonymous | hkg1 / default | 200 |  |  |
| `login/login_cellphone.10004-risk.json` | `login_cellphone` | anonymous | hkg1 / default | 400 |  | 默认伪装 IP；扫码登录成功后 37 秒发起 |
| `login/login_cellphone.200.json` | `login_cellphone` | vip-sms | hkg1 / real | 200 |  | 真实国内 IP |
| `login/login_qr_check.800-expired.json` | `login_qr_check` | anonymous | hkg1 / default | 200 |  |  |
| `login/login_qr_check.801-waiting.json` | `login_qr_check` | anonymous | hkg1 / default | 200 |  |  |
| `login/login_qr_check.802-scanned.json` | `login_qr_check` | anonymous | hkg1 / default | 200 |  |  |
| `login/login_qr_check.803-success.json` | `login_qr_check` | anonymous | hkg1 / real | 200 |  | 扫码成功；Set-Cookie 不收录，各条 Cookie 的有效期见 #14 留言 |
| `login/login_qr_create.json` | `login_qr_create` | anonymous | hkg1 / default | 200 |  |  |
| `login/login_qr_key.json` | `login_qr_key` | anonymous | hkg1 / default | 200 |  |  |
| `login/login_refresh.qr.json` | `login_refresh` | vip-qr | hkg1 / default | 200 |  |  |
| `login/login_refresh.sms.json` | `login_refresh` | vip-sms | hkg1 / default | 200 |  |  |
| `login/login_status.anonymous.json` | `login_status` | anonymous | hkg1 / default | 200 |  |  |
| `login/login_status.vip.json` | `login_status` | vip-qr | hkg1 / default | 200 |  |  |
| `login/logout.json` | `logout` | vip-sms | hkg1 / default | 200 |  | 对续期前的旧短信 Cookie 退出 |
| `login/user_account.anonymous.json` | `user_account` | anonymous | hkg1 / default | 200 |  |  |
| `login/user_account.vip.json` | `user_account` | vip-qr | hkg1 / default | 200 |  |  |
| `login/user_detail.vip.json` | `user_detail` | vip-qr | hkg1 / default | 200 |  |  |
| `login/vip_info.vip.json` | `vip_info` | vip-qr | hkg1 / default | 200 |  |  |
| `login/vip_info_v2.vip.json` | `vip_info_v2` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/lyric_new.all-forms.json` | `lyric_new` | anonymous | hkg1 / default | 200 |  |  |
| `playback/lyric_new.lrc-only.json` | `lyric_new` | anonymous | hkg1 / default | 200 |  |  |
| `playback/lyric_new.pure-music.json` | `lyric_new` | anonymous | hkg1 / default | 200 |  |  |
| `playback/lyric_new.romaji.json` | `lyric_new` | anonymous | hkg1 / default | 200 |  |  |
| `playback/lyric_new.translation.json` | `lyric_new` | anonymous | hkg1 / default | 200 |  |  |
| `playback/lyric_new.uncollected.json` | `lyric_new` | anonymous | hkg1 / default | 200 |  |  |
| `playback/lyric_new.yrc.json` | `lyric_new` | anonymous | hkg1 / default | 200 |  |  |
| `playback/scrobble.json` | `scrobble` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_download_url_v1.no-copyright.json` | `song_download_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_download_url_v1.vip-exhigh.json` | `song_download_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_download_url_v1.vip-hires.json` | `song_download_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_download_url_v1.vip-lossless.json` | `song_download_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_url_v1.anon-free.json` | `song_url_v1` | anonymous | hkg1 / real | 200 |  |  |
| `playback/song_url_v1.anon-trial.json` | `song_url_v1` | anonymous | hkg1 / real | 200 |  |  |
| `playback/song_url_v1.no-copyright.json` | `song_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_url_v1.vip-exhigh.json` | `song_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_url_v1.vip-higher.json` | `song_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_url_v1.vip-hires.json` | `song_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_url_v1.vip-jyeffect.json` | `song_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_url_v1.vip-jymaster.json` | `song_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_url_v1.vip-lossless.json` | `song_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_url_v1.vip-sky.json` | `song_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `playback/song_url_v1.vip-standard.json` | `song_url_v1` | vip-qr | hkg1 / default | 200 |  |  |
| `search/cloudsearch.album.json` | `cloudsearch` | anonymous | hkg1 / default | 200 |  |  |
| `search/cloudsearch.artist.json` | `cloudsearch` | anonymous | hkg1 / default | 200 |  |  |
| `search/cloudsearch.playlist.json` | `cloudsearch` | anonymous | hkg1 / default | 200 |  |  |
| `search/cloudsearch.song.json` | `cloudsearch` | anonymous | hkg1 / default | 200 |  |  |
| `search/search_suggest.json` | `search_suggest` | anonymous | hkg1 / default | 200 |  |  |
| `search/search_suggest.mobile.json` | `search_suggest` | anonymous | hkg1 / default | 200 |  |  |
| `like-collect/album_sub.subscribe-again.json` | `album_sub` | vip-qr | hkg1 / default | 200 |  | 已经收藏了，再收藏一次 |
| `like-collect/album_sub.subscribe.json` | `album_sub` | vip-qr | hkg1 / default | 200 |  |  |
| `like-collect/album_sub.unsubscribe-again.json` | `album_sub` | vip-qr | hkg1 / default | 404 |  | 已经取消了，再取消一次 |
| `like-collect/album_sub.unsubscribe.json` | `album_sub` | vip-qr | hkg1 / default | 200 |  |  |
| `like-collect/artist_sub.subscribe-again.json` | `artist_sub` | vip-qr | hkg1 / default | 200 |  | 已经收藏了，再收藏一次 |
| `like-collect/artist_sub.subscribe.json` | `artist_sub` | vip-qr | hkg1 / default | 200 |  |  |
| `like-collect/artist_sub.unsubscribe-again.json` | `artist_sub` | vip-qr | hkg1 / default | 200 |  | 已经取消了，再取消一次 |
| `like-collect/artist_sub.unsubscribe.json` | `artist_sub` | vip-qr | hkg1 / default | 200 |  |  |
| `like-collect/like.like-again.json` | `like` | vip-qr | hkg1 / default | 200 |  | 已经红心了，再红心一次 |
| `like-collect/like.like.json` | `like` | vip-qr | hkg1 / default | 200 |  |  |
| `like-collect/like.unlike-again.json` | `like` | vip-qr | hkg1 / default | 200 |  | 已经取消了，再取消一次 |
| `like-collect/like.unlike.json` | `like` | vip-qr | hkg1 / default | 200 |  |  |
| `like-collect/playlist_subscribe.405-weapi.json` | `playlist_subscribe` | vip-qr | hkg1 / default | 405 |  | 同一个请求改走 weapi，仍是 405 |
| `like-collect/playlist_subscribe.405.json` | `playlist_subscribe` | vip-qr | hkg1 / default | 405 |  | 收藏别人的歌单：回 405“操作过于频繁”（这一轮收藏任何歌单都是 405，见 #15 留言） |
| `like-collect/playlist_subscribe.own.json` | `playlist_subscribe` | vip-qr | hkg1 / default | 405 |  | 收藏自己的歌单：回 405“操作过于频繁”（这一轮收藏任何歌单都是 405，见 #15 留言） |
| `like-collect/playlist_subscribe.real-ip.json` | `playlist_subscribe` | vip-qr | hkg1 / real | 405 |  | 改用真实国内 IP（realIP） |
| `like-collect/playlist_subscribe.subscribe.json` | `playlist_subscribe` | vip-qr | hkg1 / default | 405 |  | 上一次 405 之后隔了约 20 分钟再试 |
| `playlist-edit/image_upload_token.json` | `image_upload_token` | vip-qr | hkg1 / default | 200 |  |  |
| `playlist-edit/nos_upload.31mb.json` | `nos_upload` | vip-qr | browser | 200 |  | 3200×3200、31,030,986 字节的 JPEG：直传成功，图片服务器能正常输出原图（6.5 MB）和缩略图；没有设为封面 |
| `playlist-edit/nos_upload.61mb.json` | `nos_upload` | vip-qr | browser | 200 |  | 4500×4500、61,399,534 字节的 JPEG：直传成功，但图片服务器拒绝输出（FileTooBig），设为封面后显示不出来 |
| `playlist-edit/nos_upload.800.json` | `nos_upload` | vip-qr | browser | 200 |  | 800×800、质量 0.88、293,393 字节的 JPEG |
| `playlist-edit/playlist_catlist.json` | `playlist_catlist` | vip-qr | hkg1 / default | 200 | 是 |  |
| `playlist-edit/playlist_cover_update.deleted-playlist.json` | `playlist_cover_update` | vip-qr | hkg1 / default | 200 |  | 给已删除的歌单设封面（图片是前面直传成功的那张） |
| `playlist-edit/playlist_cover_update.imgid-200px.json` | `playlist_cover_update` | vip-qr | hkg1 / default | 200 |  | 200×200 的 JPEG |
| `playlist-edit/playlist_cover_update.imgid-61mb.json` | `playlist_cover_update` | vip-qr | hkg1 / default | 200 |  | 4500×4500、61,399,534 字节的 JPEG（直传成功）。设封面回 200，但图片服务器拒绝输出这张图（FileTooBig），封面显示不出来 |
| `playlist-edit/playlist_cover_update.imgid.json` | `playlist_cover_update` | vip-qr | hkg1 / default | 200 |  |  |
| `playlist-edit/playlist_cover_update.not-uploaded.json` | `playlist_cover_update` | vip-qr | hkg1 / default | 200 |  | 申请了上传凭证、没有直传就设为封面：回 200，封面地址打开是 NotAnImage |
| `playlist-edit/playlist_create.private.json` | `playlist_create` | vip-qr | hkg1 / default | 200 |  |  |
| `playlist-edit/playlist_delete.deleted-playlist.json` | `playlist_delete` | vip-qr | hkg1 / default | 200 |  | 再删一次已删除的歌单 |
| `playlist-edit/playlist_delete.json` | `playlist_delete` | vip-qr | hkg1 / default | 200 |  |  |
| `playlist-edit/playlist_desc_update.deleted-playlist.json` | `playlist_desc_update` | vip-qr | hkg1 / default | 200 |  | 给已删除的歌单改简介 |
| `playlist-edit/playlist_desc_update.json` | `playlist_desc_update` | vip-qr | hkg1 / default | 200 |  |  |
| `playlist-edit/playlist_detail.deleted.json` | `playlist_detail` | vip-qr | hkg1 / default | 200 | 是 | 歌单已被删除：仍回 200 和完整歌单，playlist.status 是 10（正常歌单是 0） |
| `playlist-edit/playlist_name_update.deleted-playlist.json` | `playlist_name_update` | vip-qr | hkg1 / default | 200 |  | 给已删除的歌单改名 |
| `playlist-edit/playlist_name_update.json` | `playlist_name_update` | vip-qr | hkg1 / default | 200 |  |  |
| `playlist-edit/playlist_name_update.too-long.json` | `playlist_name_update` | vip-qr | hkg1 / default | 200 |  | 名称 41 个字符：英文和空格 10 个、汉字 31 个，宽度 72（汉字算 2），超过上限 40 |
| `playlist-edit/playlist_order_update.json` | `playlist_order_update` | vip-qr | hkg1 / default | 200 |  | 全部自建歌单（我喜欢的音乐在最前），把临时歌单从第 2 挪到最后 |
| `playlist-edit/playlist_order_update.with-deleted.json` | `playlist_order_update` | vip-qr | hkg1 / default | 200 |  | 自建歌单的顺序里还带着刚删除的那张（其余顺序不变） |
| `playlist-edit/playlist_privacy.already-public.json` | `playlist_privacy` | vip-qr | hkg1 / default | 200 |  | 已经是公开歌单，再改一次 |
| `playlist-edit/playlist_privacy.json` | `playlist_privacy` | vip-qr | hkg1 / default | 200 |  | 隐私歌单改公开 |
| `playlist-edit/playlist_tags_update.3-tags.json` | `playlist_tags_update` | vip-qr | hkg1 / default | 200 |  |  |
| `playlist-edit/playlist_tags_update.4-tags.json` | `playlist_tags_update` | vip-qr | hkg1 / default | 200 |  |  |
| `playlist-edit/playlist_tags_update.deleted-playlist.json` | `playlist_tags_update` | vip-qr | hkg1 / default | 200 |  | 给已删除的歌单设标签 |
| `playlist-edit/playlist_tags_update.unknown-tag.json` | `playlist_tags_update` | vip-qr | hkg1 / default | 200 |  | 标签库里没有的标签 |
| `playlist-edit/playlist_tracks.add-1000.json` | `playlist_tracks` | vip-qr | hkg1 / default | 200 | 是 | 一次加 1,000 首 |
| `playlist-edit/playlist_tracks.add-1500-into-9000.json` | `playlist_tracks` | vip-qr | hkg1 / default | 200 | 是 | 歌单里已有 9,000 首，再加 1,500 首（加完 10,500 首，没有遇到数量上限） |
| `playlist-edit/playlist_tracks.add-2000.json` | `playlist_tracks` | vip-qr | hkg1 / default | 200 | 是 | 一次加 2,000 首 |
| `playlist-edit/playlist_tracks.add-9000.json` | `playlist_tracks` | vip-qr | hkg1 / default | 200 | 是 | 一次加 9,000 首（往一张新建的空歌单） |
| `playlist-edit/playlist_tracks.add-deleted-playlist.json` | `playlist_tracks` | vip-qr | hkg1 / default | 404 |  | 往已删除的歌单加歌 |
| `playlist-edit/playlist_tracks.add-duplicate.json` | `playlist_tracks` | vip-qr | hkg1 / default | 200 |  | 这首已经在歌单里 |
| `playlist-edit/playlist_tracks.add-partly-duplicate.json` | `playlist_tracks` | vip-qr | hkg1 / default | 200 |  | 一首已在歌单里、一首不在 |
| `playlist-edit/playlist_tracks.add.json` | `playlist_tracks` | vip-qr | hkg1 / default | 200 |  | 一次加 3 首 |
| `playlist-edit/playlist_tracks.del-deleted-playlist.json` | `playlist_tracks` | vip-qr | hkg1 / default | 404 |  | 从已删除的歌单移除歌 |
| `playlist-edit/playlist_tracks.del-not-in-playlist.json` | `playlist_tracks` | vip-qr | hkg1 / default | 200 |  | 编号 1 不在歌单里 |
| `playlist-edit/playlist_tracks.del.json` | `playlist_tracks` | vip-qr | hkg1 / default | 200 |  |  |
| `playlist-edit/song_order_update.deleted-playlist.json` | `song_order_update` | vip-qr | hkg1 / default | 404 |  | 给已删除的歌单排序 |
| `playlist-edit/song_order_update.extra-one.json` | `song_order_update` | vip-qr | hkg1 / default | 200 | 是 | 提交的新顺序多了 1 首不在歌单里的歌（编号 1） |
| `playlist-edit/song_order_update.missing-one-small-change.json` | `song_order_update` | vip-qr | hkg1 / default | 200 | 是 | 首尾互换，同时漏掉第 101 首（本地副本过期的情形） |
| `playlist-edit/song_order_update.missing-one.json` | `song_order_update` | vip-qr | hkg1 / default | 400 | 是 | 提交的新顺序少了歌单里的 1 首，其余 4,966 首倒序（大改动，约 3.3 秒后回 -1） |
| `playlist-edit/song_order_update.partial-10.json` | `song_order_update` | vip-qr | hkg1 / default | 200 |  | 只提交前 10 首的新顺序（其余 4,957 首没放进去） |
| `playlist-edit/song_order_update.whole-4967-reversed.json` | `song_order_update` | vip-qr | hkg1 / default | 400 | 是 | 整张歌单 4,967 首倒序一次提交。约 3.3 秒后回 HTTP 400 / -1，但网易云其实已经按这个顺序改好了 |
| `playlist-edit/song_order_update.whole-4967-shuffled.json` | `song_order_update` | vip-qr | hkg1 / default | 400 | 是 | 整张歌单 4,967 首打乱后一次提交。约 3.3 秒后回 HTTP 400 / -1，但网易云其实已经按这个顺序改好了 |
| `playlist-edit/song_order_update.whole-4967-small-change.json` | `song_order_update` | vip-qr | hkg1 / default | 200 | 是 | 整张歌单 4,967 首一次提交，只把第 6 首挪到最前（拖动一次的情形） |
| `playlist-edit/user_playlist.with-private-temp.json` | `user_playlist` | vip-qr | hkg1 / default | 200 | 是 | 新建一张隐私歌单之后的歌单列表：新歌单排在我喜欢的音乐之后（第 2 位），privacy 是 10 |
