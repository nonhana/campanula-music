<!--
  同步提示：首次同步的进度（同步了几首 / 一共几首，加一条进度条，不写百分比）、同步暂停（什么时候接着同步）、同步出错时的重试；不需要提示时什么都不画。
  桌面是一条白色面板；手机是一条细条（文字行 + 2px 进度线），跟着内容滚走。
  它推开下面的内容：出现时 200ms 展开、字从上面飘下来，走时先淡出再收起（DESIGN.md Overlays，motion.ts 的 unfold）；
  同步中、暂停、出错之间换的时候新的说明淡入
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import type { LibraryState } from '#lib/app/library.js'
  import { CircleAlert, RefreshCw } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { fade, unfold } from '../motion'
  import Button from '../ui/Button.svelte'
  import TextButton from '../ui/TextButton.svelte'
  import { formatCount, syncNotice } from './view'

  interface Props {
    library: LibraryState
    /** 这一页别的地方已经说了同步为什么没成功：出错时不再重复 */
    failureShown?: boolean
    phone?: boolean
    /** 提示和下面内容之间的间距（例如 pb-10）：算在展开、收起的高度里，提示走了间距也跟着收起 */
    class?: ClassValue
  }

  const { library, failureShown = false, phone = false, class: klass }: Props = $props()
  const view = getAppView()
  const notice = $derived(syncNotice(library, failureShown))
  const progress = $derived(notice?.kind === 'syncing' ? notice.progress : null)
  const percent = $derived(progress && progress.songs.total > 0 ? Math.round((progress.songs.done / progress.songs.total) * 100) : 0)

  /** 同步暂停后面那半句：什么时候接着同步（手机写成“同步暂停 · …”，桌面是标题旁的浅色字） */
  const PAUSED = {
    rateLimited: '稍后自动继续',
    offline: '联网后接着同步',
  }
</script>

{#if notice}
  <div transition:unfold>
    <div class={klass}>
      {#if phone}
        <div role={notice.kind === 'failed' ? 'alert' : 'status'}>
          {#key notice.kind}
            <div in:fade>
              <div class={['flex items-center gap-2 px-4 text-caption text-neutral-600', notice.kind === 'failed' ? 'min-h-11 py-1' : 'h-9']}>
                {#if notice.kind === 'failed'}
                  <CircleAlert size={14} class='flex-none text-error-700' aria-hidden='true' />
                  <!-- 出错的说明不截断：哪件事没成、为什么，要看得全 -->
                  <span class='min-w-0 flex-1'>{notice.text}</span>
                  <TextButton size='caption' class='-mr-2 px-2!' onclick={() => view.app.retrySync()}>重试</TextButton>
                {:else}
                  <RefreshCw size={14} class={['flex-none', notice.kind === 'syncing' ? 'animate-spin text-primary-800' : 'text-neutral-500']} aria-hidden='true' />
                  <span class='min-w-0 flex-1 truncate'>{notice.kind === 'syncing' ? '正在同步曲库' : `同步暂停 · ${PAUSED[notice.kind]}`}</span>
                  {#if progress}
                    <span class='flex-none tabular-nums'>{formatCount(progress.songs.done)} / {formatCount(progress.songs.total)}</span>
                  {/if}
                {/if}
              </div>
              {#if progress}
                <div class='mx-4 h-[2px] overflow-hidden rounded-full bg-primary-100' aria-hidden='true'>
                  <div class='h-full rounded-full bg-primary-800' style:width='{percent}%'></div>
                </div>
              {/if}
            </div>
          {/key}
        </div>
      {:else}
        <div class='rounded-xl bg-white shadow-ambient' role={notice.kind === 'failed' ? 'alert' : 'status'}>
          {#key notice.kind}
            <div class='min-h-14 flex items-center gap-4 px-5 py-2' in:fade>
              {#if notice.kind === 'failed'}
                <CircleAlert size={18} class='flex-none text-error-700' aria-hidden='true' />
                <p class='min-w-0 flex-1 text-label text-neutral-900 font-500'>{notice.text}</p>
                <Button variant='outline' class='h-9!' onclick={() => view.app.retrySync()}>重试</Button>
              {:else}
                <RefreshCw size={18} class={['flex-none', notice.kind === 'syncing' ? 'animate-spin text-primary-800' : 'text-neutral-500']} aria-hidden='true' />
                <p class='min-w-0 flex-1 truncate text-label text-neutral-900 font-500'>
                  {#if notice.kind === 'syncing'}
                    正在同步曲库
                  {:else}
                    同步暂停<span class='ml-2 text-neutral-600 font-400'>{PAUSED[notice.kind]}</span>
                  {/if}
                </p>
                {#if progress}
                  <span class='h-4 w-px flex-none bg-neutral-200' aria-hidden='true'></span>
                  <p class='flex-none text-caption text-neutral-600 tabular-nums'>{formatCount(progress.songs.done)} / {formatCount(progress.songs.total)} 首</p>
                  <span class='relative h-1 w-40 flex-none overflow-hidden rounded-full bg-primary-100' aria-hidden='true'>
                    <span class='absolute inset-y-0 left-0 rounded-full bg-primary-800' style:width='{percent}%'></span>
                  </span>
                {/if}
              {/if}
            </div>
          {/key}
        </div>
      {/if}
    </div>
  </div>
{/if}
