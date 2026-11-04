<!--
  换歌单封面的裁剪页（#34，原型 CoverFlow 方案 A）：手机全屏、桌面居中弹窗，页头一直写“换封面”。
  - 选图后先读（只有转圈，读屏“正在读取图片”）：不是图片、超过 20 MB、HEIC 解不开、读不出来都用标题说清，要换成什么样的图时下面再加一句，给“换一张图片”；裁剪时取景框能一指拖动、两指捏合、滚轮、滑块、方向键调整，拖动时页面和弹层都不滚，怎么操作只写在读屏说明里（CoverCropper）。
  - 点“使用”后保留只读封面预览，主要按钮文字不变、转圈。上传可以取消、回到裁剪；设为封面已经发出时关不掉。失败保留原因和重试，设为封面失败后重试不重新上传。
  成功才收起：歌单封面马上换成设为歌单封面后返回的地址（App 的 prepareCover / uploadCover / retryCover / cancelCover / closeCover）。浮层栈把它叠在歌单编辑上面，统一处理返回、Esc、上传中钉住与关闭后的焦点。
-->
<script lang='ts'>
  import { CircleAlert, ImageOff, LoaderCircle, X } from '@lucide/svelte'
  import { untrack } from 'svelte'
  import { innerHeight, innerWidth } from 'svelte/reactivity/window'

  import type { CoverCrop } from '#lib/api/cover.js'
  import { COVER_INPUT_MAX_BYTES } from '#lib/api/cover.js'
  import type { RequestFailure } from '#lib/app/api-client.js'
  import type { CoverFailure, CoverProblem, CoverStep } from '#lib/app/cover.js'

  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import { failureText } from '../shared/failure'
  import { dialog, fade, float } from '../shared/motion'
  import { PAGE_DISTANCE } from '../shared/motion-tokens'
  import Button from '../ui/Button.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import Scrollbar from '../ui/Scrollbar.svelte'
  import { centerCrop } from './cover-crop-core'
  import CoverCropper from './CoverCropper.svelte'

  const view = getAppView()
  const { coverEditor } = getOverlays()
  const request = $derived(coverEditor.request)

  const cover = $derived(view.state.cover)
  const sheet = $derived(coverEditor.asSheet)
  /** 设为封面已经发给服务器，停不下来 */
  const closable = $derived(!(cover?.status === 'uploading' && cover.upload.step === 'set'))

  /** 取景框边长：手机按屏宽，桌面固定；窗口太矮时留出按钮和说明的位置 */
  const box = $derived(sheet
    ? Math.max(220, Math.min((innerWidth.current ?? 390) - 48, (innerHeight.current ?? 844) - 330))
    : Math.max(260, Math.min(420, (innerHeight.current ?? 844) - 300)))

  let root = $state<HTMLElement>()
  let input = $state<HTMLInputElement>()
  let retrying = $state(false)
  /** 现在裁剪的是哪张预览：换了一张图才重置取景框 */
  const croppedUrl = $derived(cover && 'image' in cover
    ? cover.image.url
    : null)
  let crop = $derived.by<CoverCrop>(() => {
    void croppedUrl
    return untrack(() => cover && 'image' in cover
      ? centerCrop(cover.image.width, cover.image.height)
      : { x: 0, y: 0, size: 1 })
  })

  // 成功才关上（状态一变就收）；关的时候顺手收起浅路由
  $effect(() => {
    if (cover?.status === 'done' && coverEditor.request)
      untrack(() => close())
  })

  // 歌单在别处被删掉、同步先发现了：收起裁剪页，别把整个 App 的 inert 留着。
  // 设为封面已经发出去时 close() 不动作，让它回来
  $effect(() => {
    const current = coverEditor.request
    if (!current)
      return
    if (!view.state.library?.playlists?.some(playlist => playlist.id === current.playlistId && playlist.kind === 'own'))
      untrack(() => coverEditor.invalidate())
  })

  /** 裁剪页落在取景框上；上传能取消时落在取消键，不能取消时落在忙碌按钮，失败后落在重试 */
  const focusKey = $derived(
    cover?.status === 'uploading'
      ? `uploading:${closable}`
      : cover?.status === 'failed'
      ? `failed:${cover.upload.failure.kind}`
      : cover?.status ?? '',
  )
  $effect(() => {
    const key = focusKey
    if (!key)
      return
    queueMicrotask(() => {
      const target = key === 'cropping'
        ? root?.querySelector<HTMLElement>('[role="application"]')
        : root?.querySelector<HTMLElement>('[data-autofocus]')
      target?.focus({ preventScroll: true })
    })
  })

  const pick = (): void => {
    input?.click()
  }

  const onfile = (event: Event): void => {
    const element = event.currentTarget as HTMLInputElement
    const file = element.files?.[0]
    element.value = ''
    if (file && request)
      void view.app.prepareCover(request.playlistId, file)
  }

  const close = (): void => {
    void coverEditor.close()
  }

  const useCover = (): void => {
    retrying = cover?.status === 'failed'
    if (retrying)
      void view.app.retryCover()
    else
      void view.app.uploadCover(crop)
  }

  /** 选到的文件为什么不能用：标题一句话说清；还要说怎么换一张能用的才有正文 */
  const problemText = (problem: CoverProblem): { title: string, body?: string } => {
    switch (problem.kind) {
      case 'notImage':
        return { title: '这个文件不是图片', body: '请选 JPG、PNG 或 WebP 图片' }
      case 'tooBig':
        return { title: `图片不能超过 ${COVER_INPUT_MAX_BYTES / 1024 / 1024} MB` }
      case 'heic':
        return { title: '这张 HEIC 照片打不开', body: '先在相册里存成 JPG 再选' }
      case 'unreadable':
        return { title: '这张图片读不出来' }
    }
  }

  /** 哪一步没成：一句话，请求本身的问题后面跟原因（failureText） */
  const uploadFailureText = (step: CoverStep | null, failure: CoverFailure): string => {
    if (failure.kind === 'uploadFailed')
      return '图片没能上传'
    if (failure.kind === 'exportFailed')
      return '没能裁出这张图片'
    const reason = failureText(failure as RequestFailure)
    if (step === null)
      return reason
    if (step === 'set')
      return `没能设为封面：${reason}`
    return `图片没能上传：${reason}`
  }
</script>

{#if request && cover}
  {#if sheet}
    <div
      bind:this={root}
      class='fixed inset-0 z-80 flex flex-col bg-primary-50'
      role='dialog'
      aria-modal='true'
      aria-labelledby='cover-title'
      in:float={{ toward: 'down', distance: PAGE_DISTANCE.in, panel: true }}
      out:float={{ toward: 'down', distance: PAGE_DISTANCE.out, panel: true }}
    >
      <header class='h-14 flex flex-none items-center gap-1 px-1'>
        <IconButton
          icon={X}
          label={cover?.status === 'uploading' && cover.upload.step !== 'set'
            ? '取消上传'
            : '关闭'}
          disabled={!closable}
          onclick={close}
        />
        <h2 id='cover-title' class='min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-600'>换封面</h2>
        <span class='w-11 flex-none'></span>
      </header>
      <div class='min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4 pt-2'>
        <Scrollbar />
        {@render body()}
      </div>
      <div class='flex-none px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2'>
        {@render actions()}
      </div>
    </div>
  {:else}
    <button type='button' class='fixed inset-0 z-80 bg-neutral-900/35' aria-label='关闭' tabindex='-1' onclick={() => close()} transition:fade></button>
    <div class='pointer-events-none fixed inset-0 z-81 grid place-items-center p-6'>
      <div
        bind:this={root}
        class='pointer-events-auto max-h-[calc(100dvh-48px)] max-w-[620px] w-full flex flex-col rounded-xl bg-white shadow-float'
        role='dialog'
        aria-modal='true'
        aria-labelledby='cover-title'
        transition:dialog
      >
        <header class='flex flex-none items-center gap-3 pb-2 pl-6 pr-4 pt-5'>
          <h2 id='cover-title' class='min-w-0 flex-1 truncate text-title-sm text-neutral-900 font-600'>换封面</h2>
          <IconButton icon={X} label='关闭' disabled={!closable} onclick={close} />
        </header>
        <div class='min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2'>
          <Scrollbar />
          {@render body()}
        </div>
        <div class='flex flex-none items-center justify-end gap-2 px-6 pb-5 pt-4'>
          {@render actions()}
        </div>
      </div>
    </div>
  {/if}
{/if}

{#snippet body()}
  {#if cover}
    {#if cover.status === 'picking'}
      <div class='grid place-items-center py-16' role='status'>
        <LoaderCircle size={28} class='animate-spin text-primary-800' aria-hidden='true' />
        <span class='sr-only'>正在读取图片</span>
      </div>
    {:else if cover.status === 'unusable'}
      {@const why = problemText(cover.problem)}
      <div class='flex flex-col items-center py-8 text-center'>
        <span class='grid size-12 place-items-center rounded-full bg-error-50 text-error-700' aria-hidden='true'><ImageOff size={24} /></span>
        <h3 class='mt-3 text-title-sm text-neutral-900 font-600'>{why.title}</h3>
        {#if why.body}<p class='mt-1.5 max-w-[36rem] text-body text-neutral-700'>{why.body}</p>{/if}
      </div>
    {:else if cover.status !== 'done'}
      <div class='flex flex-col items-center gap-3'>
        <CoverCropper
          src={cover.image.url}
          width={cover.image.width}
          height={cover.image.height}
          size={box}
          readonly={cover.status !== 'cropping'}
          bind:crop
        />
        {#if cover.status === 'cropping' && cover.small}
          <p class='w-full flex items-start gap-1.5 text-caption text-neutral-600'>
            <CircleAlert size={14} class='mt-0.5 flex-none' aria-hidden='true' />
            图片较小，封面可能会糊
          </p>
        {:else if cover.status === 'uploading'}
          <p class='sr-only' role='status'>正在更换封面</p>
        {:else if cover.status === 'failed'}
          <p class='w-full flex items-start gap-2 rounded-lg bg-error-50 px-3 py-2.5 text-caption text-error-700' role='alert'>
            <CircleAlert size={16} class='mt-0.5 flex-none' aria-hidden='true' />
            {uploadFailureText(cover.upload.step, cover.upload.failure)}
          </p>
        {/if}
      </div>
    {/if}
  {/if}
{/snippet}

{#snippet actions()}
  {#if cover}
    {#if cover.status === 'picking'}
      <div class={sheet ? 'grid gap-2' : 'flex justify-end gap-2'}>
        <Button variant='outline' onclick={() => close()} data-autofocus>取消</Button>
      </div>
    {:else if cover.status === 'unusable'}
      <div class={sheet ? 'grid gap-2' : 'flex justify-end gap-2'}>
        <Button variant='outline' onclick={() => close()}>先不换</Button>
        <Button variant='primary' onclick={pick} data-autofocus>换一张图片</Button>
      </div>
    {:else if cover.status !== 'done'}
      <div class={sheet ? 'grid grid-cols-2 gap-2 [&>*:only-child]:col-span-2' : 'flex justify-end gap-2'}>
        {#if cover.status === 'cropping' || (cover.status === 'failed' && cover.upload.failure.kind === 'exportFailed')}
          <Button variant='outline' onclick={pick}>换一张</Button>
        {:else if cover.status === 'failed'}
          <Button variant='outline' onclick={() => close()}>先不换</Button>
        {:else if closable}
          <Button variant='outline' onclick={() => view.app.cancelCover()} data-autofocus>取消上传</Button>
        {/if}
        <Button
          variant='primary'
          busy={cover.status === 'uploading'}
          data-autofocus={cover.status === 'failed' || !closable
            ? true
            : undefined}
          onclick={useCover}
        >{cover.status === 'failed' || (cover.status === 'uploading' && retrying)
          ? '重试'
          : '使用'}</Button>
      </div>
    {/if}
  {/if}
{/snippet}

<input bind:this={input} type='file' accept='image/*' class='sr-only' tabindex='-1' aria-hidden='true' onchange={onfile} />
