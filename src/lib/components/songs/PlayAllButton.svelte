<!--
  播放全部（歌单页、专辑页、歌手页、我喜欢的音乐、每日推荐、已下载；歌手页放歌曲标签当前排法已经显示的歌）：用整个列表替换播放队列，从第一首现在能放的开始（App 的 playAll）。
  列表还没出来（songs 是 null）、一首现在能放的都没有（无版权；断网、没登录时没下载的，#38）时不能按
-->
<script lang='ts'>
  import { Play } from '@lucide/svelte'

  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'

  import { getAppView } from '../shared/app-context.svelte'
  import Button from '../ui/Button.svelte'
  import { songLook } from './song-look'

  const { songs, source, label = '播放全部' }: { songs: readonly Song[] | null, source: PlaySource, label?: string } = $props()
  const view = getAppView()
</script>

<Button variant='primary' icon={Play} disabled={!songs?.some(song => !songLook(view, song).off)} onclick={() => view.app.playAll(source)}>{label}</Button>
