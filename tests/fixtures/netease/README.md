# 网易云真实返回（验证关卡①录制）

来源：nonhana/campanula-music#14（验证关卡①），2026-10-08 在 Vercel 上的一次性测试版（分支 `gate/vercel`）里录制，SDK 为 `hana-music-api@1.4.0`。登录态用作者的主账号（会员），其余是未登录（匿名）视角。

供 nonhana/hana-music-api#17–#21 的契约测试和 Campanula 自己的测试使用。自动化测试只读这些文件，不连真实账号（Spec #11“交付方式”第 3 条）。

## 使用前须知

- `playback/scrobble.json`：网易云回了 `{"code":200,"data":"success"}`，但这次打卡**没有计入**听歌排行（41 分钟后仍未变化，见 #14 留言）。它只代表“接口返回的样子”，不代表打卡有效。
- 扫码时要求行为验证的 8821 这次没有出现，没有录到。
- `login/login_cellphone.10004-risk.json` 是短信登录被风控拦下的真实返回；`login/captcha_sent.502-anonymous-registration.json` 是 SDK 1.4.0 匿名注册失败时的返回（报错原文里的“MUSIC_A”只是文字，不是凭据）。
- 首次同步时“我喜欢的音乐”的歌单详情原始返回约 3.1 MB、一次 1,000 首的歌曲信息约 2.1 MB；这里的文件只留了前 30 项，原长度见 `context.truncated`。

## 文件格式

每个文件是一次 SDK 调用：

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
- 超过 30 项的数组只留前 30 项，原长度记在 `context.truncated`。
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
