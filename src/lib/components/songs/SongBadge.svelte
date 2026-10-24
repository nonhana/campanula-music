<!--
  跟在歌名后面的徽标（DESIGN.md Chips · Badges）：无版权、断网时没下载（#38，“未下载”）用淡发丝底，只能试听用琥珀。
  一行只显示一个，先后见 songs/song-look.ts 的 songLook
-->
<script lang='ts'>
  import type { SongBadgeKind } from './song-look'

  const { kind }: { kind: SongBadgeKind | null } = $props()
  const LABELS: Record<SongBadgeKind, string> = { noCopyright: '无版权', notDownloaded: '未下载', trial: '试听' }
</script>

{#if kind}
  <span class={['flex-none rounded-sm px-1.5 text-micro font-500', kind === 'trial' ? 'bg-warning-50 text-warning-900' : 'bg-neutral-100 text-neutral-700']}>{LABELS[kind]}</span>
{/if}
