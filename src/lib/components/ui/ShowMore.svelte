<!--
  列表后面还有时的“显示更多”（DESIGN.md Overlays · 加载更多）：搜索结果的每一类和歌手页的专辑共用。
  正在取时按钮文字不变、转圈，再按也不重复取；没取成时一句“没能 + 动作：原因”（淡入），按钮变成“重试”；
  点“重试”以后转圈时仍写“重试”（DESIGN.md Copy：进行中不换字）；取完了按钮淡出。
  排版（居中还是靠左、左右留白）由调用的地方给 class
-->
<script lang='ts'>
  import { CircleAlert } from '@lucide/svelte'
  import type { ClassValue } from 'svelte/elements'

  import type { RequestFailure } from '#lib/app/api-client.js'

  import { failureText } from '../shared/failure'
  import { fade } from '../shared/motion'
  import Button from './Button.svelte'

  interface Props {
    /** 后面还有：还没取、正在取、没取成；都取到了是 null */
    more: { status: 'notLoaded' | 'loading' } | { status: 'failed', failure: RequestFailure } | null
    onmore: () => void
    /** 没取成时原因前面那半句（“没能加载更多”） */
    failed?: string
    class?: ClassValue
  }

  const { more, onmore, failed = '没能加载更多', class: klass }: Props = $props()

  /** 这一次是没取成之后点的“重试” */
  let retrying = $state(false)
  const onclick = () => {
    retrying = more?.status === 'failed'
    onmore()
  }
</script>

{#if more}
  <div class={['flex flex-wrap items-center gap-3', klass]} out:fade>
    {#if more.status === 'failed'}
      <p class='min-w-0 flex items-center gap-2 text-caption text-neutral-700' role='alert' in:fade>
        <CircleAlert size={16} class='flex-none text-error-700' aria-hidden='true' />
        <span>{failed}：{failureText(more.failure)}</span>
      </p>
    {/if}
    <Button variant='outline' busy={more.status === 'loading'} {onclick}>
      {more.status === 'failed' || (more.status === 'loading' && retrying)
        ? '重试'
        : '显示更多'}
    </Button>
  </div>
{/if}
