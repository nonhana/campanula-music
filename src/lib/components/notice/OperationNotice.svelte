<script lang="ts">
  import type { NoticeAction, NoticeEntry } from '#lib/app/notice.js';

  import { getAppView } from '../shared/app-context.svelte';
  import NoticeCard from './NoticeCard.svelte';
  import { operationNoticeText } from './text';

  const {
    entry,
    phone,
    edge,
    moved,
    onaction = (id: number, action: NoticeAction) =>
      view.app.noticeAction(id, action),
  }: {
    entry: NoticeEntry;
    phone: boolean;
    edge: 'top' | 'bottom';
    moved: boolean;
    onaction?: (id: number, action: NoticeAction) => void | Promise<void>;
  } = $props();
  const view = getAppView();

  const ACTIONS = {
    undo: '撤销',
    resume: '继续下载',
    retry: '重试',
  } as const;

  const action = $derived.by(() => {
    const name = entry.actions.find(
      (candidate): candidate is keyof typeof ACTIONS => candidate in ACTIONS,
    );
    return name
      ? {
          label: ACTIONS[name],
          run: () => void onaction(entry.id, name),
        }
      : null;
  });
</script>

<NoticeCard
  tone={entry.tone}
  text={operationNoticeText(entry.notice)}
  {phone}
  {edge}
  {moved}
  name="operation-notice-{entry.id}"
  action={action ?? undefined}
  onclose={() => void onaction(entry.id, 'dismiss')}
/>
