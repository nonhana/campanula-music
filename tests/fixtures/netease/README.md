# 网易云真实返回（验证关卡①②和之后各票录制）

来源：验证关卡①②在 Vercel 上的一次性测试版（分支 `gate/vercel`）里录制，SDK 为 `hana-music-api@1.4.0`，登录态用作者的主账号（会员）；之后各票的录制在本机直接调 SDK，见下面各条。

- 验证关卡①（nonhana/campanula-music#14，2026-10-08）：`login/`、`library/`、`playback/`、`search/`。登录后的录制之外，其余是未登录（匿名）视角。
- 验证关卡②（nonhana/campanula-music#15，2026-10-09 北京时间）：`playlist-edit/`（歌单编辑：新建、删除、名称和简介、标签、隐私、封面、加歌和移除、排序、自建歌单之间排序）、`like-collect/`（红心、收藏和取消收藏）。歌单写操作只在临时新建、测完即删的歌单上做。
- nonhana/campanula-music#20（2026-10-11）：`login/login_refresh.301-invalid.json`、`login/user_account.invalid.json`。在本机用 `hana-music-api@2.2.0` 直接调 SDK，带一个随机编造、不属于任何账号的 `MUSIC_U`，不涉及真实账号。
- nonhana/campanula-music#21（2026-10-12 北京时间）：`library/` 下文件名带 `.full`、`.liked-full`、`.liked-page` 的整页录制。作者在本机开发服务器的登录页扫码登录一次，一次性脚本用这份凭据直接调 `hana-music-api@2.3.0`，只读：歌单列表 1 次、我喜欢的音乐详情 1 次、歌曲信息每页 1,000 首共 5 次；第 4 页被 SDK 拒掉后，又逐个去掉出错的歌调了 4 次、用 `fetcher` 截网易云原样的返回 1 次。凭据只在内存里，原始录制脱敏后当场删了。同一票里 `library/likelist.301-invalid.json`（SDK 2.3.0）和 `library/user_playlist.anonymous-view.json.gz`（SDK 2.4.0，看的是作者本人的歌单列表，没用作者的凭据）用随机编造的 `MUSIC_U`。#22 时补做了本人作为歌手的脱敏：`.liked-page1`、`.liked-page3`、`.liked-full` 里本人的歌手编号、名字和作品编号原来没换，已换成 `99999999` / “测试歌手”和 9 字头的假编号。
- nonhana/campanula-music#22（2026-10-12 北京时间）：`library/sync/` 下三批整个曲库的录制，作者在本机开发服务器扫码登录，一次性脚本用这份凭据直接调 `hana-music-api@2.4.0`，只读，照 App 的同步顺序：
  - `before/`：作者在官方 App 里新建临时歌单 poems（2 首）之后：歌单列表 1 次，我喜欢的音乐以外的 53 张歌单详情各 1 次，还没有的歌曲信息 45 页（我喜欢的音乐当作已经同步过，用 #21 的录制）。另有 `user_account`、`user_detail` 各 1 次，只为拿到要脱敏的本人身份。
  - `after/`：作者在官方 App 里往 poems 加了一首、移除了一首之后：歌单列表 1 次，更新时间变了的 4 张歌单详情各 1 次（poems 之外的 3 张网易云自己改了更新时间，歌没变），新的歌 1 页。
  - `deleted/`：作者在官方 App 里删掉 poems 之后：歌单列表 1 次（poems 不在了），更新时间变了的 1 张歌单详情 1 次。
  - 文件名前的序号是调用的先后。编号和 #21 那批对得上：本人歌单的假编号按名字沿用，poems 是 `900000019`；收藏的歌单创建者沿用 #21 的假 uid，新出现的人从 `10000035` 起。歌单详情里的 `playlist.tracks`、`privileges` 截到前 30 项。临时歌单录完已在官方 App 里删掉。
- nonhana/campanula-music#23（2026-10-13 北京时间）：`library/album-artist/` 下收藏的专辑和歌手、专辑页、歌手页的录制。一次性脚本用作者本机开发服务器的登录 Cookie 直接调 `hana-music-api@2.7.1`，照服务端真实的参数，**不截短**（测试要核对收藏的列表、专辑曲目和歌手专辑的条数，以及“显示更多专辑”）；文件名前的序号是第一次录制时调用的先后：
  - `001`、`002`：收藏的专辑（55 张）、收藏的歌手（236 位），`limit: 1000` 一次取完。
  - `003`、`004`：YOASOBI 的歌手页：热门歌曲 50 首，专辑一页 100 张（65 张，`more` 是 false）。
  - `005`–`007`：まらしぃ的歌手页（收藏的歌手里专辑刚过一页的）：热门歌曲，专辑一页一页取到底（100 张 + 1 张）。
  - `008`–`010`：专辑页，每张之间隔 4 秒（连着取会回“操作频繁”，nonhana/hana-music-api#60）：收藏的「Keep The Village Alive」（3149073）、收藏的「月に寄りそう乙女の作法2 COMPLETE SOUNDTRACK」（3154337，没有简介，`description` 是 null，nonhana/hana-music-api#59）、没收藏的 YOASOBI「THE BOOK for,」（379547126）。
  - `011`：成对操作（Spec #11 交付方式第 2 条）：用 SDK 收藏「THE BOOK for,」，取收藏的专辑（56 张，它排在最前）录下，马上取消收藏，再取一次确认回到 55 张（没录）。收藏、取消收藏的返回没录（`like-collect/album_sub.*` 已有）。
  - 专辑页的 `album.info.commentThread.resourceInfo.userId` 是 -1（没有这个人）。第一次录制时脱敏把它当成了一个人，`008`–`010` 没写成；修好录制脚本（现在的 `scripts/netease-record.mts`）后几分钟内只读重录了这三张，所以它们的 `recordedAt` 比 `011` 晚。
- nonhana/campanula-music#24（2026-10-14 北京时间）：`playback/liked/` 下我喜欢的音乐里 6 首歌的在线播放地址（`song_url_v1`，极高音质 `exhigh`）。一次性脚本用作者本机开发服务器的登录 Cookie 直接调 `hana-music-api@2.8.0`，只读，每首 1 次；文件名前的序号是调用的先后：
  - `001`–`003`：我喜欢的音乐的第 1～3 首（3433267939、2662577181、4208408）。
  - `004`、`005`：无版权的「Sea Of Tired（Slowed）」（2108191414）前后各一首（2092188841、2044505920）。
  - `006`：最后一首（22712173）。
  - 都是完整的地址（`freeTrialInfo` 是 null），`expi` 1,200 秒。录完当场用 https 取了其中两首的前 1 KB，回 206，音频服务器支持 https 和分段请求。
- nonhana/campanula-music#28（2026-10-17 北京时间）：`playback/check-in/001-scrobble.json.gz`，听歌打卡走 SDK 2.8.1 起的新接口（clientlog，nonhana/hana-music-api#31）的返回。作者在本机开发服务器扫码登录，一次性脚本用这份凭据直接调 `hana-music-api@2.9.0`，参数和 Campanula 服务端发的一样（`source: 'list'`，`sourceid` 是我喜欢的音乐，`time` 是整首的整数秒），**只打卡 1 次**。前后各读一次本周听歌排行和累计听歌数（`user_record`、`user_detail`，只读，没录）：13 分钟后这首的本周次数从 1 变成 2、得分从 16 变成 33，计入了排行。
- nonhana/campanula-music#29（2026-10-17 北京时间）：`discover/daily/` 下每日推荐和从每日推荐来的一次打卡。一次性脚本用作者本机开发服务器的登录 Cookie 直接调 `hana-music-api@2.9.0`，**不截短**（测试要核对“整份每日推荐”）；文件名前的序号是调用的先后：
  - `001-recommend_songs`：当天的每日推荐，31 首，都能放完整的（`privilege.st` 都是 0、`pl` 都大于 0）。只读 1 次。
  - `002-scrobble`：打卡的播放来源照 SDK 文档「播放来源」：`source: 'recommend'`、`sourceid: 0`（每日推荐没有稳定的编号），`time` 是整首的整数秒，**只打卡 1 次**（13:06）。打卡对象是本周听歌排行的最后一首《Only U》（3364306023），打卡前本周 1 次、得分 14；**17.6 分钟后变成 2 次、得分 28**，计入了排行。前后读排行用的 `user_record`、`user_detail` 都只读，没有录进仓库。
- nonhana/campanula-music#31（2026-10-17 北京时间）：`search/songs/` 下的搜索建议和单曲搜索、`search/check-in/` 下从搜索来的一次打卡。一次性脚本用作者本机开发服务器的登录 Cookie 直接调 `hana-music-api@2.9.0`，参数和 Campanula 服务端发的一样；文件名前的序号是调用的先后：
  - `001`、`002-search_suggest`：先打了“夜に”、再打完“夜に駆ける”时的建议，只读各 1 次。
  - `003-cloudsearch`：搜“夜に駆ける”的单曲（`limit: 100`，截到前 30 首）；`004-cloudsearch`：搜“Sea Of Tired Slowed”（28 首，不截短），最后 3 首无版权。登录后单曲搜索里能放的歌 `privilege.st` 是 0、无版权的是 -200，和歌曲信息一样；验证关卡①匿名录的 `search/cloudsearch.song.json` 里 3 首都是 -100，那是没登录的样子，不代表无版权。
  - 想找一个一首都搜不到的词没找到：试了 9 个乱码一样的词，7 个网易云都模糊搜出了几首到几百首；另外 2 个（`𓀀𓀁𓀂𓀃`、`⌘⌥⇧⌃⎋⏏`）的第 49 首没有 `al.name`，SDK 2.9.0 把整页拒掉（502，nonhana/hana-music-api#79），没录。
  - `search/check-in/001-scrobble`：打卡的播放来源照 SDK 文档「播放来源」：`source: 'search'`、`sourceid: 0`（一次搜索没有稳定的编号），`time` 是整首的整数秒，**只打卡 1 次**（19:34）。打卡对象是本周听歌排行的最后一首《好景不长》（3410153999），打卡前本周 1 次、得分 14；**24.5 分钟后变成 2 次、得分 28**，计入了排行。前后读排行用的 `user_record`、`user_detail` 都只读，没有录进仓库。
- nonhana/campanula-music#31 验收不通过后的返工（2026-10-18 北京时间）：`search/kinds/` 下建议里的四类和歌手 / 歌单 / 专辑结果，给 SDK 声明新字段做契约测试数据（nonhana/hana-music-api#82），也给建议下拉和搜索结果页（综合 + 四类）的测试用。一次性脚本同样用作者本机开发服务器的登录 Cookie 直接调 `hana-music-api@2.9.0`，全部只读、各 1 次，截到前 30 项：
  - `001-search_suggest`：“真夜中”。网易云给了单曲 4、专辑 2、歌单 2，**没有歌手**（`order` 是 `songs`、`albums`、`playlists`）；第 2、3 首歌名看着一样，一个用 `～`（U+FF5E）、一个用 `〜`（U+301C）。`002-search_suggest`：“周杰伦”，单曲 4、歌手 1、专辑 2、歌单 2。网易云只在搜的词就是歌手名时才在建议里给歌手（另外只读试过 YOASOBI、椎名林檎，各给 1 位，没录）。
  - `003`–`005-cloudsearch`：“真夜中”的歌手（`type: 100`，共 27 位）、歌单（`1000`，共 188 张）、专辑（`10`，共 503 张）。歌单带 `playCount`；歌手的 `fansSize` 登录后也都是 null（验证关卡①匿名录的 `cloudsearch.artist.json` 一样），搜索结果里拿不到粉丝数。
  - 另外只读试过 `cloudsearch` 的 `type: 1018`（综合）和 `search_multimatch`（最佳匹配），返回都是空的（`result` 没有内容、`orders` 是空数组），用不了，没录。
- nonhana/campanula-music#56（2026-10-18 北京时间）：`library/netease-playlist/` 下打开不在曲库里的歌单要用的录制。一次性脚本用作者本机开发服务器的登录 Cookie 直接调 `hana-music-api@2.10.0`，全部只读、各 1 次，**不截短**（测试要核对分页和条数）；文件名前的序号是调用的先后：
  - `001-playlist_detail`、`002-song_detail`：搜“真夜中”的歌单结果里的「ACAね / ずっと真夜中でいいのに。」（95050200，81 首，没收藏，`subscribed` 是 false）和它的歌曲信息。
  - `003-playlist_detail`、`004`、`005-song_detail`：「评论过万日语歌合集」（2137987910，1,201 首，没收藏），歌曲信息每页 1,000 首：1,000 首 + 201 首。
  - `006-playlist_detail`：不存在的歌单（99999999999）：404“歌单不存在”。
  - `007-playlist_detail`：#22 时在官方 App 里删掉的临时歌单 poems（假编号 900000019），创建者本人看：照样 200 和完整歌单，`status` 是 10（SDK 2.11.0 起声明，nonhana/hana-music-api#86）。
  - `anonymous/`：作者只有一个账号，“别人看”用匿名身份（不带凭据）代替。`001-playlist_detail`：poems，别人看已删除的，同样 200、`status` 10。`002-playlist_detail`：作者在官方 App 里临时建的隐私歌单（假编号 900000022，录完删掉），别人看：401“该歌单已被创建者设置为隐私”。匿名注册第一次回 502“Anonymous registration did not return MUSIC_A”，换一个 deviceId 重试一次就好了，失败的那次没录。
  - 第一次想用 SDK 新建临时歌单录隐私歌单，`playlist_create` 回 405“操作过于频繁”，什么都没建成。别人的歌单列表（`user_playlist`）里看不到隐私歌单（只读翻了 12 位，没录），所以只能自己建。
- nonhana/campanula-music#32（2026-10-18 北京时间）：`search/results/` 下搜索结果页的四类分页。一次性脚本用作者本机开发服务器的登录 Cookie 直接调 `hana-music-api@2.12.0`，参数和 Campanula 服务端发的一样（每页 `limit: 30`，`offset` 从 0 起），全部只读、各 1 次，不截短（每页本来就 30 项）；文件名前的序号是调用的先后，同一批录的前后页对得上：
  - `001`、`002`：“真夜中”的单曲第 1、2 页（网易云说共 330 首）。`003`、`004`：歌单第 1、2 页（共 189 张）。`005`：歌手（27 位，一页就完）。`006`、`007`：专辑第 1、2 页（共 503 张）。
  - `008`、`009`：“初音ミク”的歌手第 1 页 30 位、第 2 页 10 位（共 40 位）。先只读探过一次总数，没录。
  - `010`：“Sea Of Tired Slowed”的歌手：一位都没有，网易云不给 `artists`，只给 `artistCount: 0`。之前只读探了一次，没录。
  - 网易云翻页时会把前面已经给过的又给一次：第一次录（18:20，那时录制用的登录已经失效，录到的是匿名视角，那批删了）“初音ミク”的第 2 页里有 3 位第 1 页已经有了；登录后连着录了 5 对第 1、2 页都没有重复（没录）。#31 返工时录的 `search/kinds/005`（专辑第 1 页）和今天的 `007` 有 5 张重复，测试拿它们当“隔了一阵才显示更多”。
  - 想录一页真实的出错返回给“综合里一块出错”的测试用：nonhana/hana-music-api#79 里会被整页拒掉的两个词（`⌘⌥⇧⌃⎋⏏`、`𓀀𓀁𓀂𓀃`），SDK 2.12.0 下第 1、2 页都正常返回了，没录到。作者定不构造，这条只测断网。

供 nonhana/hana-music-api#17–#22 的契约测试和 Campanula 自己的测试使用。自动化测试只读这些文件，不连真实账号（Spec #11“交付方式”第 3 条）。

## 使用前须知

- `playback/scrobble.json`：SDK 1.4.0 旧接口的返回。网易云回了 `{"code":200,"data":"success"}`，但这次打卡**没有计入**听歌排行（41 分钟后仍未变化，见 #14 留言）。它只代表“接口返回的样子”，不代表打卡有效。能计入的新接口的返回是 `playback/check-in/001-scrobble.json.gz`（#28）。
- 扫码时要求行为验证的 8821 这次没有出现，没有录到。测试 8821 分支用的是构造的数据，见下面“构造的数据”。
- `login/login_cellphone.10004-risk.json` 是短信登录被风控拦下的真实返回；`login/captcha_sent.502-anonymous-registration.json` 是 SDK 1.4.0 匿名注册失败时的返回（报错原文里的“MUSIC_A”只是文字，不是凭据）。
- 首次同步时“我喜欢的音乐”的歌单详情原始返回约 3.1 MB、一次 1,000 首的歌曲信息约 2.1 MB；验证关卡①②的文件只留了前 30 项，原长度见 `context.truncated`。
- `.json.gz`：#21 的整页录制，**不截短**（作者的我喜欢的音乐 4,984 首、歌单列表 53 张、每页 1,000 首的歌曲信息），用 gzip 压缩，测试替身直接读（`tests/harness/fixtures.ts`）；要看内容用 `gzip -dc 文件 | jq`。这一批的编号自成一套：本人是 `10000001`，我喜欢的音乐是 `900000001`，和验证关卡①②的假编号不对应。#22 的 `library/sync/`、#23 的 `library/album-artist/`、#24 的 `playback/liked/`、#28 的 `playback/check-in/`、#29 的 `discover/daily/`、#31 的 `search/songs/`、`search/check-in/`、`search/kinds/`、#56 的 `library/netease-playlist/`、#32 的 `search/results/` 也是 `.json.gz`。
- `library/song_detail.liked-page4.*`：第 4 页里有 3 首传到云盘、没匹配上曲库的歌（1984488794、1959160688、1916897283），网易云回的 `ar[0].name`、`al.name` 是 null。`hana-music-api@2.3.0` 要求它们是字符串，**整页 1,000 首都被拒掉**（502 `UnexpectedUpstreamShape`）；2.4.0 起原样返回（nonhana/hana-music-api#48）。不带后缀的 `song_detail.liked-page4.json.gz` 是网易云原样的返回（SDK 校验之前截下），2.4.0 能通过结构校验；`.502-null-artist` 是 2.3.0 真实的拒绝，2.4.0 下别人看云盘上传的歌（歌名也是 null）时照样这样拒，测试拿它当“这一页没取到”。
- 凭据无效时（#21，编造的 `MUSIC_U`）：`likelist` 回 301；`user_playlist`、`playlist_detail` 回 200 的匿名视角，每张歌单的 `subscribed` 是 null（已登录时是 true / false）；`song_detail` 照常 200。2.3.0 把匿名视角当结构不符报 502，2.4.0 起原样返回，Campanula 的服务端认出 `subscribed` 是 null 就当作需要登录（`library/user_playlist.anonymous-view.json.gz`）。
- `playlist-edit/playlist_tracks.*`：SDK 1.4.0 的 `playlist_tracks` 在网易云回 HTTP 200 时，把返回多包了一层：`response.body` 是 `{ status, body: { code, count, trackIds }, cookie }`，外层看不出成败，要看里面的 `body.code`（整批都已在歌单里时是 502“歌单内歌曲重复”）。网易云回 HTTP 错误时（比如歌单不存在的 404）`response.body` 是平的 `{ code, message }`。
- `playlist-edit/song_order_update.whole-4967-reversed.json`、`…whole-4967-shuffled.json`：一次改动几千首位置的排序，网易云约 3.3 秒后回 HTTP 400 / `-1`“请求异常，请稍后重试”，但新顺序其实已经生效（重新读歌单确认过）。只挪动几首时同样大小的请求 0.5 秒回 200（`…whole-4967-small-change.json`）。`…missing-one.json`（少提交一首、其余倒序）同样回 `-1`，2 秒后重读时新顺序还没有完全生效。
- `playlist-edit/playlist_detail.deleted.json`：已删除的歌单仍回 200 和完整歌单，只有 `playlist.status` 是 10（正常歌单是 0）。对已删除的歌单加歌、移除、排序回 404“歌单不存在”；改名称、简介、标签、封面和再删一次都回 200。
- `like-collect/playlist_subscribe.*`：验证关卡②里用 SDK 1.4.0 收藏歌单一律回 405“操作过于频繁，请稍后再试”：自己的、别人的歌单，eapi、weapi，默认伪装 IP、真实国内 IP，隔 20 分钟再试，都一样；同一时间作者在官方 App 里收藏、取消都正常，专辑、歌手、红心也都正常。所以这些文件代表的是 SDK 发的请求被拒的样子，不是收藏歌单成功的返回（见 #15 留言）。原因由 nonhana/hana-music-api#32 查明：设备身份 `os=pc`、写死的 checkToken，任一个都会被拒。`hana-music-api@2.0.0` 已改写法，修复后的模块还没在真账号上成功过（nonhana/hana-music-api#33）。收藏成功、取消成功的返回在 hana-music-api 仓库的 `tests/fixtures/netease/playlist_subscribe/`。
- `playlist-edit/nos_upload.*` 不是 SDK 调用，是浏览器拿 `image_upload_token` 的凭证直传网易云图片存储（`nosup-hz1.127.net`）的返回：`query` 写图片的尺寸、字节数和 JPEG 质量。
- 每批录制分别脱敏，假编号不跨批次对应：比如验证关卡①②两边的 `900000002` 不是同一张歌单。
- `login/*.invalid.json`、`login/login_refresh.301-invalid.json`：凭据无效时，`user_account` 照样回 200，只是 `account`、`profile` 都是 null；`login_refresh` 回 301，同时下发一条新的 `NMTID`（没有收录）。所以“需要登录”要看 `user_account` 有没有账号，或者看接口回不回 301（#14 留言）。

## 文件格式

每个文件是一次 SDK 调用（`playlist-edit/nos_upload.*` 例外：它是浏览器直传网易云图片存储的返回，`context` 里没有 `sdk` 和 `ip`，`region` 是 `browser`）：

```jsonc
{
  "module": "song_url_v1", // SDK 模块名
  "query": { "id": 0, "level": "exhigh" },
  "context": {
    "recordedAt": "…", // 录制时间（UTC）
    "sdk": "hana-music-api@1.4.0",
    "region": "hkg1", // Vercel 函数地区；local = 作者本机
    "ip": "default", // default = SDK 默认伪装 IP；real = 传入真实国内 IP；none = 不带
    "viewer": "vip-qr", // anonymous / vip-qr（扫码登录）/ vip-sms（短信登录）/ invalid（编造的无效凭据）
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
- 超过 30 项的数组只留前 30 项，原长度记在 `context.truncated`；查询参数里上千个编号的列表（加歌的 `tracks`、排序的 `ids`）同样只留前 30 个，记在 `context.truncated` 的 `query.*` 路径下。#21 的整页录制（`.json.gz`）为了测分页不截短，#23 的 `library/album-artist/` 为了核对条数不截短。
- 上传凭证（`image_upload_token` 返回的 `token`）清空；图片编号和地址是测试时画的图，原样保留。
- 其余结构和取值原样保留。

## 录制

新的录制用 `scripts/netease-record.mts`，每张票只写一个一次性脚本决定调哪些模块，放在 `_notes/scripts/`（不进仓库），用 `pnpm tsx _notes/scripts/<文件>.mts` 跑：

```ts
import { loadIdentity } from '../../scripts/fixture-identity.mts'
import { createRecorder, openSession } from '../../scripts/netease-record.mts'

// 登录 Cookie 从 _notes/campanula-login 读，见下面第一条
const invoke = await openSession()
const recorder = createRecorder({ invoke, dir: 'tests/fixtures/netease/library/sync/after', viewer: 'vip-qr' })
const list = await recorder.call('user_playlist', { uid: loadIdentity()!.self.uid, limit: 1000 })
// list.ok 时 list.body 是 SDK 收窄过的返回，按它决定接着调什么
const { written, problems } = recorder.save() // problems 不为空：那几个文件有残留，没写
```

- tsx 只跑不查类型。一次性脚本要查类型，就先放进 `scripts/` 跑一次 `pnpm check`（`scripts/**/*.mts` 在类型检查里），再挪回 `_notes/scripts/`。
- 登录 Cookie：作者在浏览器开发者工具（Application → Cookies）里复制 `campanula_login` 的值，存进作者本机的 `_notes/campanula-login`。录制脚本只从这个文件读，值不出现在命令行和对话里；文件不在时 `openSession()` 报错，停下来请作者存。
- `save()` 按上面「脱敏」的规则处理，写之前用 `scripts/fixture-identity.mts` 查残留；对照表在作者本机的 `_notes/fixture-identity.json`（本人的 uid、昵称、歌手编号和名字，本人歌单、作品、其他听众的真假编号对照）。录到新的人、本人新的歌单和作品时补进对照表，之后的录制沿用同一套假编号。
- 提交时 `lint-staged` 对暂存的录制跑同一个检查，有残留就拦下；没有对照表的机器（CI）跳过。手动查全部：`pnpm tsx scripts/fixture-identity.mts`。
- 对照表不在了要重建：本人身份用 `/api/account`，本人歌单的真实编号用浏览器里的 `/api/playlists`，作品的真实编号用本机副本里歌手是本人的歌，按名字和录制里 `99999999` 的歌对上。

## 构造的数据

文件名带 `.constructed` 的不是录制，`context.constructed` 是 `true`：8821 那三份是 #19 为了测 8821 分支构造的（作者同意，2026-10-11），真遇到 8821 时录下来替换掉；另一个账号是 #21 构造的（作者同意，2026-10-12，作者只有一个账号）；限流那份是 #21 为了测“操作频繁”的退避构造的，真遇到限流时录下来替换掉。

| 文件 | 构造了什么、依据 |
|---|---|
| `login/login_qr_check.8821-verify.constructed.json` | 扫码确认后网易云要求行为验证。`message` 照真实报错的原文（chaunsin/netease-cloud-music#26 里贴的 `8821 需要行为验证码验证`）；`data` 里的 `verifyId`、`verifyType`、`verifyToken`、`params.event_id`、`params.sign` 照开源实现 saltbo/zme 的 `NeteaseRiskData`（它把这几项交给 `/frontrisk/verify/getqrcode`，和 SDK `verify_getQr` 的参数一一对应），取值是假的 |
| `login/login_qr_check.8821-no-params.constructed.json` | 同一个 8821，但 `data` 是 null：上面那个 issue 里贴的返回只有 `code`、`message`，没有验证参数 |
| `login/verify_getQr.constructed.json` | 照 SDK 2.2.0 的 `verify_getQr`：网易云只给 `data.qrCode`，`qrurl` 是 SDK 用 `qrCode` 和查询参数拼的，`qrimg` 是 `qrurl` 的二维码（用 SDK 依赖的 `qrcode` 生成）。过 SDK 的 `VerifyGetQrBody` 校验 |
| `login/login_cellphone.200.another-account.constructed.json` | 同一台设备上换另一个网易云账号登录。作者只有一个账号：复制 `login/login_cellphone.200.json`，只把账号的 uid（10000001 → 10000002）和昵称（“另一位听众”）换掉 |
| `library/song_detail.405-rate-limited.constructed.json` | 网易云对接口限流的返回没有录到过（验证关卡①首次同步没遇到）。复制 `like-collect/playlist_subscribe.405.json` 的返回体（405“操作过于频繁，请稍后再试”，`hana-music-api@2.3.0` 认作限流，抛出时加上 `retryAfter`），只把模块换成 `song_detail`。注意那份 405 本身是请求写法被拒，不一定是真的限流（见上面 `like-collect/playlist_subscribe.*`） |

它们不进下面的清单。

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
| `library/likelist.301-invalid.json` | `likelist` | invalid | local / default | 301 |  | SDK 2.3.0；编造的 MUSIC_U：凭据失效时红心回 301 |
| `library/playlist_detail.liked.json` | `playlist_detail` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/playlist_detail.liked-full.json.gz` | `playlist_detail` | vip-qr | local / default | 200 |  | SDK 2.3.0；我喜欢的音乐 4,984 首的全部曲目编号（`trackCount` 写的是 4,981） |
| `library/playlist_detail.own-small.json` | `playlist_detail` | vip-qr | hkg1 / default | 200 |  |  |
| `library/playlist_detail.subscribed.json` | `playlist_detail` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/playlist_track_all.json` | `playlist_track_all` | vip-qr | hkg1 / default | 200 |  |  |
| `library/recommend_songs.json` | `recommend_songs` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/song_detail.anon.json` | `song_detail` | anonymous | hkg1 / default | 200 |  |  |
| `library/song_detail.vip.json` | `song_detail` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/song_detail.liked-page1.json.gz` | `song_detail` | vip-qr | local / default | 200 |  | SDK 2.3.0；我喜欢的音乐第 1–1,000 首 |
| `library/song_detail.liked-page2.json.gz` | `song_detail` | vip-qr | local / default | 200 |  | 第 1,001–2,000 首 |
| `library/song_detail.liked-page3.json.gz` | `song_detail` | vip-qr | local / default | 200 |  | 第 2,001–3,000 首 |
| `library/song_detail.liked-page4.502-null-artist.json.gz` | `song_detail` | vip-qr | local / default | 502 |  | 第 3,001–4,000 首：SDK 2.3.0 认不出 3 首云盘上传的歌，整页拒掉（nonhana/hana-music-api#48） |
| `library/song_detail.liked-page4.json.gz` | `song_detail` | vip-qr | local / default | 200 |  | 同一页网易云原样的返回（SDK 校验之前截下）；2.4.0 起通过结构校验 |
| `library/song_detail.liked-page5.json.gz` | `song_detail` | vip-qr | local / default | 200 |  | 第 4,001–4,984 首 |
| `library/user_playlist.json` | `user_playlist` | vip-qr | hkg1 / default | 200 | 是 |  |
| `library/user_playlist.full.json.gz` | `user_playlist` | vip-qr | local / default | 200 |  | SDK 2.3.0；53 张，我喜欢的音乐在最前 |
| `library/user_playlist.anonymous-view.json.gz` | `user_playlist` | invalid | local / default | 200 |  | SDK 2.4.0；编造的 MUSIC_U 看本人的歌单列表：匿名视角，53 张的 `subscribed` 都是 null |
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
| `login/login_refresh.301-invalid.json` | `login_refresh` | invalid | local / default | 301 |  | SDK 2.2.0；编造的 MUSIC_U：续期被拒 |
| `login/login_status.anonymous.json` | `login_status` | anonymous | hkg1 / default | 200 |  |  |
| `login/login_status.vip.json` | `login_status` | vip-qr | hkg1 / default | 200 |  |  |
| `login/logout.json` | `logout` | vip-sms | hkg1 / default | 200 |  | 对续期前的旧短信 Cookie 退出 |
| `login/user_account.anonymous.json` | `user_account` | anonymous | hkg1 / default | 200 |  |  |
| `login/user_account.vip.json` | `user_account` | vip-qr | hkg1 / default | 200 |  |  |
| `login/user_account.invalid.json` | `user_account` | invalid | local / default | 200 |  | SDK 2.2.0；编造的 MUSIC_U：account、profile 都是 null |
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
