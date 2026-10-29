<!--
  一摞里的一条操作提示（改曲库、下载共用，最多 3 条；文案见 text.ts）：失败的一直留着直到关掉，成功的 4 秒后自己走（App 的时钟管，见 app/notice.ts）。
  动作也由 App 决定（entry.actions）：这里只照着画，不按种类猜该调哪个方法。样子在 NoticeCard。
-->
<script lang='ts'>
  import type { NoticeAction, NoticeEntry } from '#lib/app/notice.js'

  import { getAppView } from '../shared/app-context.svelte'
  import NoticeCard from './NoticeCard.svelte'
  import { operationNoticeText } from './text'

  const { entry, phone, edge, moved, onaction = (id: number, action: NoticeAction) => view.app.noticeAction(id, action) }: {
    entry: NoticeEntry
    phone: boolean
    edge: 'top' | 'bottom'
    moved: boolean
    /** 设计页的模拟提示用：不接 App，自己处理动作 */
    onaction?: (id: number, action: NoticeAction) => void | Promise<void>
  } = $props()
  const view = getAppView()

  const ACTIONS = {
    undo: '撤销',
    resume: '继续下载',
    retry: '重试',
  } as const

  const action = $derived.by(() => {
    const name = entry.actions.find((candidate): candidate is keyof typeof ACTIONS => candidate in ACTIONS)
    return name
      ? {
        label: ACTIONS[name],
        run: () => void onaction(entry.id, name),
      }
      : null
  })
</script>

<NoticeCard
  tone={entry.tone}
  text={operationNoticeText(entry.notice)}
  {phone}
  {edge}
  {moved}
  name='operation-notice-{entry.id}'
  action={action ?? undefined}
  onclose={() => void onaction(entry.id, 'dismiss')}
/>
