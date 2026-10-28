<!--
  一摞里的一条（改曲库、下载共用，最多 3 条；文案见 text.ts）：失败的一直留着直到关掉，成功的 4 秒后自己走（App 的时钟管，见 app/notice.ts）。
  动作也由 App 决定（entry.actions）：这里只照着画，不按种类猜该调哪个方法。
  位置和换位置的交叉淡化在 NoticeStack，这里只管一条的样子；换页时原地不动。
-->
<script lang='ts'>
  import { Check, CircleAlert, X } from '@lucide/svelte'

  import type { NoticeEntry } from '#lib/app/notice.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { toast } from '../shared/motion'
  import IconButton from '../ui/IconButton.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import { operationNoticeText } from './text'

  const { entry, phone, edge, moved }: {
    entry: NoticeEntry
    phone: boolean
    edge: 'top' | 'bottom'
    moved: boolean
  } = $props()
  const view = getAppView()
</script>

<div
  class={[
    'notice pointer-events-auto flex items-center gap-2.5 rounded-xl bg-white py-1.5 pl-3.5 pr-1.5 shadow-float',
    phone
      ? 'w-full'
      : 'w-max max-w-[min(560px,calc(100vw-48px))]',
  ]}
  role={entry.tone === 'error'
    ? 'alert'
    : 'status'}
  style:view-transition-name={`operation-notice-${entry.id}`}
  style:view-transition-class='still'
  transition:toast|global={{ edge, moved }}
>
  {#if entry.tone === 'success'}
    <Check size={18} class='flex-none text-primary-900' aria-hidden='true' />
  {:else}
    <CircleAlert size={18} class='flex-none text-error-700' aria-hidden='true' />
  {/if}
  <p class='min-w-0 flex-1 text-caption text-neutral-800'>{operationNoticeText(entry.notice)}</p>
  {#if entry.actions.includes('undo')}
    <TextButton strong class='md:h-10 px-3.5!' onclick={() => void view.app.noticeAction(entry.id, 'undo')}>撤销</TextButton>
  {:else if entry.actions.includes('resume')}
    <TextButton strong class='md:h-10 px-3.5!' onclick={() => void view.app.noticeAction(entry.id, 'resume')}>继续下载</TextButton>
  {:else if entry.actions.includes('retry')}
    <TextButton strong class='md:h-10 px-3.5!' onclick={() => void view.app.noticeAction(entry.id, 'retry')}>重试</TextButton>
  {/if}
  <IconButton icon={X} label='关闭提示' onclick={() => void view.app.noticeAction(entry.id, 'dismiss')} />
</div>
