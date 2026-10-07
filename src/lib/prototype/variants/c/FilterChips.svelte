<!-- PROTOTYPE（变体 C）：列表上方的筛选（全部 / 已下载 / 可播放），单选。 -->
<script lang='ts'>
  import type { SongFilter } from './collections'
  import { formatCount } from '$lib/prototype/data'

  interface Props {
    value: SongFilter
    counts: Record<SongFilter, number>
    phone?: boolean
  }

  let { value = $bindable(), counts, phone = false }: Props = $props()

  const options: { key: SongFilter, label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'downloaded', label: '已下载' },
    { key: 'playable', label: '可播放' },
  ]
</script>

<div class='flex gap-2' role='radiogroup' aria-label='筛选歌曲'>
  {#each options as o (o.key)}
    <button
      type='button'
      role='radio'
      aria-checked={value === o.key}
      class='chip'
      class:phone
      class:on={value === o.key}
      onclick={() => (value = o.key)}
    >
      {o.label}<span class='tnum count'>{formatCount(counts[o.key])}</span>
    </button>
  {/each}
</div>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border-radius: 8px;
    background: #f3f4f6;
    color: #374151;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  .chip.phone {
    height: 36px;
  }

  .count {
    font-weight: 400;
    color: #6b7280;
  }

  .chip.on {
    background: #d1f1e3;
    color: #1a5b43;
  }

  .chip.on .count {
    color: #206f52;
  }

  @media (hover: hover) and (pointer: fine) {
    .chip:not(.on):hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
