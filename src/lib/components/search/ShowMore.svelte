<!--
  一类搜索结果后面还有时的“显示更多”（和歌手页的“显示更多专辑”一样，DESIGN.md Overlays · 加载更多）：
  正在取时按钮写“正在加载…”、再按也不重复取；没取成时说明原因（淡入），按钮变成“重试”；取完了按钮淡出
-->
<script lang='ts'>
  import type { MoreResults } from '#lib/app/search.js'
  import { CircleAlert } from '@lucide/svelte'
  import { fade } from '../motion'
  import Button from '../ui/Button.svelte'
  import { searchFailure } from './view'

  interface Props {
    /** 后面还有；都取到了是 null */
    more: MoreResults | null
    onmore: () => void
  }

  const { more, onmore }: Props = $props()
</script>

{#if more}
  <div class='flex flex-wrap items-center justify-center gap-3 px-4 pb-2 pt-4' out:fade>
    {#if more.status === 'failed'}
      <p class='min-w-0 flex items-center gap-2 text-caption text-neutral-700' role='alert' in:fade>
        <CircleAlert size={16} class='flex-none text-error-700' aria-hidden='true' />
        <span>后面的没能加载。{searchFailure(more.failure).body}</span>
      </p>
    {/if}
    <Button variant='outline' aria-disabled={more.status === 'loading'} aria-busy={more.status === 'loading'} onclick={onmore}>
      {more.status === 'loading' ? '正在加载…' : more.status === 'failed' ? '重试' : '显示更多'}
    </Button>
  </div>
{/if}
