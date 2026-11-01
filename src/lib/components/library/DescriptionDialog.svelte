<!--
  简介的阅读层（歌单、专辑共用）：页头里只留一行（手机两行）预览，全文在这里读。桌面是 680px 的居中弹窗，
  手机是底部弹层，跟着内容高、最高到屏幕的 86%（DialogShell 的 reading）。正文和歌手页的简介同一种长文（ui/LongText），
  长了在层里滚动，页面不跟着变高。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

  import DialogBody from '../overlay/DialogBody.svelte'
  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import type { DescriptionRequest } from '../overlay/overlay-requests'
  import { langOf } from '../shared/text'
  import LongText from '../ui/LongText.svelte'
  import TextButton from '../ui/TextButton.svelte'

  const { descriptionDialog } = getOverlays()
</script>

<DialogShell layer={descriptionDialog} title={() => '简介'} size={() => 'reading'}>
  {#snippet subtitle(request: DescriptionRequest)}
    <p class='truncate text-caption text-neutral-600' lang={langOf(request.name)}>「{request.name}」</p>
  {/snippet}
  {#snippet children(request: DescriptionRequest, sheet: boolean, heading: Snippet<[classes: string]>)}
    {#if sheet}
      <div class='flex flex-none items-center gap-2 px-4 pb-2'>
        {@render heading('min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-600')}
        <TextButton tone='neutral' size='body' onclick={() => descriptionDialog.close()}>完成</TextButton>
      </div>
    {/if}
    <DialogBody {sheet}>
      {#snippet body()}
        <!-- 桌面正文下面只有 8px，补到 24px；手机弹层自己留了 24px -->
        <LongText text={request.text} class={[!sheet && 'pb-4']} />
      {/snippet}
    </DialogBody>
  {/snippet}
</DialogShell>
