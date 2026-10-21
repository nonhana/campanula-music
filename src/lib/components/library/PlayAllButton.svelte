<!--
  播放全部（歌单页、专辑页、我喜欢的音乐、每日推荐、已下载；歌手页写“播放热门歌曲”）：用整个列表替换播放队列，从第一首现在能放的开始（App 的 playAll）。
  列表还没出来（songs 是 null）、一首现在能放的都没有（无版权；断网、没登录时没下载的，#38）时不能按
-->
<script lang='ts'>
  import type { Song } from '#lib/api/library.js'
  import type { PlaySource } from '#lib/api/playback.js'
  import { Play } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { songLook } from '../downloads/view'
  import Button from '../ui/Button.svelte'

  const { songs, source, label = '播放全部' }: { songs: readonly Song[] | null, source: PlaySource, label?: string } = $props()
  const view = getAppView()
</script>

<Button variant='primary' icon={Play} disabled={!songs?.some(song => !songLook(view, song).off)} onclick={() => view.app.playAll(source)}>{label}</Button>
