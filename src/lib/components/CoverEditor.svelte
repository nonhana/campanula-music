<!--
  换封面的裁剪页（#34，原型 CoverFlow 方案 A）：手机全屏、桌面居中弹窗，页头一直写“换封面”。
  - 选图后先读（只有转圈，读屏“正在读取图片”）：不是图片、超过 20 MB、HEIC 解不开、读不出来都用标题说清，要换成什么样的图时下面再加一句，给“换一张图片”；
  - 裁剪：取景框能一指拖动、两指捏合、滚轮、滑块、方向键调整，拖动时页面和弹层都不滚；怎么操作只写在读屏说明里（CoverCropper）；
  - 点“使用”后在同一页显示两步进度：上传图片（App 的申请上传凭证、直传网易云图片存储）→ 设为封面，进行中转圈、完成打 ✓，不另写字（读屏照样读得出）。
    上传图片可以取消、回到裁剪；设为封面已经发出，按钮变成“正在设为封面”，关不掉。哪一步失败都写一句什么没成、为什么；设为封面失败后重试只再设一次，不重新上传。
  成功才收起：封面马上换成设封面返回的地址（App 的 prepareCover / uploadCover / retryCover / cancelCover / closeCover）。
  手机上压一条浅路由（coverSheet），返回先收起这一层；设为封面发出去时返回也收不起来。放在 SignedInFrame 里，盖在歌单编辑上面
-->
<script lang='ts'>
  import type { CoverCrop } from '#lib/api/cover.js'
  import type { RequestFailure } from '#lib/app/api.js'
  import type { CoverFailure, CoverProblem, CoverStep, CoverUpload } from '#lib/app/cover.js'
  import type { CoverRequest } from './cover-edit.svelte'
  import { page } from '$app/state'
  import { Check, CircleAlert, ImageOff, LoaderCircle, X } from '@lucide/svelte'
  import { onDestroy, untrack } from 'svelte'
  import { COVER_INPUT_MAX_BYTES } from '#lib/api/cover.js'
  import { getAppView } from './app-context.svelte'
  import { centerCrop } from './cover-crop'
  import { coverEditor } from './cover-edit.svelte'
  import CoverCropper from './CoverCropper.svelte'
  import { failureText } from './failure'
  import { desktopLayout } from './layout'
  import { dialog, fade, float } from './motion'
  import { PAGE_DISTANCE } from './motion-tokens'
  import { pushShallowState } from './shallow-state'
  import Button from './ui/Button.svelte'
  import IconButton from './ui/IconButton.svelte'
  import Scrollbar from './ui/Scrollbar.svelte'

  const view = getAppView()
  const request = $derived(coverEditor.request)

  // 退出、登录失效时 SignedInFrame 整个拿掉，这个组件不会看到 library 变 null；请求是单例，得在这里清掉，
  // 不然下次登录后 behindCover 一直为真、整个 App 都是 inert
  onDestroy(() => {
    coverEditor.request = null
  })
  const cover = $derived(view.state.cover)
  const sheet = $derived(!desktopLayout.current)
  /** 设为封面已经发给服务器，停不下来 */
  const closable = $derived(!(cover?.status === 'uploading' && cover.upload.step === 'set'))

  /** 界面上只有两步：App 的申请上传凭证（token）、直传（upload）都算“上传图片”，能取消；“设为封面”（set）发出去就停不下来 */
  type ShownStep = 'upload' | 'set'
  const STEPS = [
    { key: 'upload', label: '上传图片' },
    { key: 'set', label: '设为封面' },
  ] as const satisfies readonly { key: ShownStep, label: string }[]
  const shownStep = (step: CoverStep): ShownStep => step === 'set' ? 'set' : 'upload'
  const orderOf = (step: ShownStep): number => STEPS.findIndex(item => item.key === step)

  /** 取景框边长：手机按屏宽，桌面固定；窗口太矮时留出按钮和说明的位置 */
  let viewport = $state({ w: 390, h: 844 })
  $effect(() => {
    const measure = () => (viewport = { w: window.innerWidth, h: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  })
  const box = $derived(sheet ? Math.max(220, Math.min(viewport.w - 48, viewport.h - 330)) : Math.max(260, Math.min(420, viewport.h - 300)))

  let root = $state<HTMLElement>()
  let input = $state<HTMLInputElement>()
  let crop = $state<CoverCrop>({ x: 0, y: 0, size: 1 })
  /** 现在裁剪的是哪张预览：换了一张图才重置取景框 */
  let croppedUrl = $state('')

  // 换了图片：取景框从居中、最大的正方形开始
  $effect(() => {
    if (!cover || !('image' in cover))
      return
    if (cover.image.url === croppedUrl)
      return
    croppedUrl = cover.image.url
    crop = centerCrop(cover.image.width, cover.image.height)
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
      untrack(() => close())
  })

  // 手机布局上：返回手势退掉了 coverSheet，先收起这一层（设为封面发出去时收不起来，压回去）。
  // 上传图片（申请凭证、直传）时，返回等于“取消上传”，停在裁剪页上
  let acknowledged: CoverRequest | null = null
  $effect(() => {
    const current = coverEditor.request
    if (!current || desktopLayout.current)
      return
    if (page.state.coverSheet) {
      acknowledged = current
      return
    }
    if (acknowledged !== current)
      return
    if (!closable) {
      pushBack()
      return
    }
    if (cover?.status === 'uploading') {
      view.app.cancelCover()
      pushBack()
      return
    }
    close(true)
  })

  function pushBack(): void {
    // 已经退掉了那一条：再压一条，返回还先收起这一层
    if (!page.state.coverSheet)
      pushShallowState({ ...page.state, coverSheet: true })
  }

  /** 焦点跟着状态和上传步骤走：裁剪页落在取景框上，上传/失败落在主要按钮上 */
  const focusKey = $derived(
    cover?.status === 'uploading'
      ? `uploading:${cover.upload.step}`
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

  function pick(): void {
    input?.click()
  }

  function onfile(event: Event): void {
    const element = event.currentTarget as HTMLInputElement
    const file = element.files?.[0]
    element.value = ''
    if (file && request)
      void view.app.prepareCover(request.playlistId, file)
  }

  /** 头上那个键：上传中先停下、回到裁剪；别的时候关上 */
  function leave(): void {
    if (cover?.status === 'uploading')
      return view.app.cancelCover()
    close()
  }

  function close(fromBack = false): void {
    const current = coverEditor.request
    if (!current || !closable)
      return
    view.app.closeCover()
    coverEditor.dismiss(current)
    if (!fromBack && page.state.coverSheet)
      history.back()
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !coverEditor.request)
      return
    event.preventDefault()
    if (cover?.status === 'uploading')
      view.app.cancelCover()
    else
      close()
  }

  const STEP_LOOK = {
    done: 'bg-primary-900 text-white',
    now: 'bg-primary-100 text-primary-950 ring-2 ring-primary-700',
    fail: 'bg-error-50 text-error-700 ring-2 ring-error-700',
    todo: 'bg-neutral-100 text-neutral-500',
  } as const

  function stepState(step: ShownStep, upload: CoverUpload): 'done' | 'now' | 'todo' | 'fail' {
    const current = upload.step === null ? -1 : orderOf(shownStep(upload.step))
    const at = orderOf(step)
    if (upload.failure && at === current)
      return 'fail'
    if (at < current)
      return 'done'
    if (at === current && !upload.failure)
      return 'now'
    return 'todo'
  }

  /** 选到的文件为什么不能用：标题一句话说清；还要说怎么换一张能用的才有正文 */
  function problemText(problem: CoverProblem): { title: string, body?: string } {
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
  function uploadFailureText(step: CoverStep | null, failure: CoverFailure): string {
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

<svelte:window onkeydown={onkeydown} />

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
          label={cover?.status === 'uploading' && cover.upload.step !== 'set' ? '取消上传' : '关闭'}
          disabled={!closable}
          onclick={leave}
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
          <IconButton icon={X} label='关闭' disabled={!closable} onclick={leave} />
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
      <div class={['flex flex-col items-center gap-3', cover.status === 'uploading' && cover.upload.step !== 'set' ? 'opacity-70' : '']}>
        <CoverCropper
          src={cover.image.url}
          width={cover.image.width}
          height={cover.image.height}
          size={box}
          readonly={cover.status !== 'cropping'}
          bind:crop
        />
        {#if cover.status === 'cropping'}
          {#if cover.small}
            <p class='w-full flex items-start gap-1.5 text-caption text-neutral-600'>
              <CircleAlert size={14} class='mt-0.5 flex-none' aria-hidden='true' />
              图片较小，封面可能会糊
            </p>
          {/if}
        {:else}
          {#if cover.status !== 'failed' || cover.upload.failure.kind !== 'exportFailed'}
            <ol class='w-full flex flex-col gap-2' aria-label='上传进度'>
              {#each STEPS as { key, label }, i (key)}
                {@const state = stepState(key, cover.upload)}
                <li class='flex items-center gap-2.5 text-label' aria-current={state === 'now' ? 'step' : undefined}>
                  <span class={['size-5 grid flex-none place-items-center rounded-full text-caption font-600', STEP_LOOK[state]]}>
                    {#if state === 'done'}
                      <Check size={13} aria-hidden='true' />
                    {:else if state === 'fail'}
                      <CircleAlert size={13} aria-hidden='true' />
                    {:else if state === 'now'}
                      <LoaderCircle size={13} class='animate-spin' aria-hidden='true' />
                    {:else}
                      {i + 1}
                    {/if}
                  </span>
                  <span class={state === 'todo' ? 'text-neutral-500' : state === 'fail' ? 'text-error-700' : 'text-neutral-900'}>{label}</span>
                  {#if state === 'done'}<span class='sr-only'>完成</span>{/if}
                </li>
              {/each}
            </ol>
          {/if}
          {#if cover.status === 'uploading'}
            {#if cover.upload.step === 'set'}
              <p class='w-full text-caption text-neutral-600' role='status'>这一步不能取消了</p>
            {/if}
          {:else}
            <p class='w-full flex items-start gap-2 rounded-lg bg-error-50 px-3 py-2.5 text-caption text-error-700' role='alert'>
              <CircleAlert size={16} class='mt-0.5 flex-none' aria-hidden='true' />
              {uploadFailureText(cover.upload.step, cover.upload.failure)}
            </p>
          {/if}
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
    {:else if cover.status === 'cropping'}
      <div class={sheet ? 'grid grid-cols-2 gap-2' : 'flex justify-end gap-2'}>
        <Button variant='outline' onclick={pick}>换一张</Button>
        <Button variant='primary' onclick={() => void view.app.uploadCover(crop)}>使用</Button>
      </div>
    {:else if cover.status === 'uploading'}
      <div class={sheet ? 'grid gap-2' : 'flex justify-end gap-2'}>
        {#if cover.upload.step === 'set'}
          <Button variant='primary' aria-disabled='true' data-autofocus class='pointer-events-none opacity-70'>正在设为封面</Button>
        {:else}
          <Button variant='outline' onclick={() => view.app.cancelCover()} data-autofocus>取消上传</Button>
        {/if}
      </div>
    {:else if cover.status === 'failed'}
      <div class={sheet ? 'grid grid-cols-2 gap-2' : 'flex justify-end gap-2'}>
        {#if cover.upload.failure.kind === 'exportFailed'}
          <Button variant='outline' onclick={pick}>换一张</Button>
        {:else}
          <Button variant='outline' onclick={() => close()}>先不换</Button>
        {/if}
        <Button variant='primary' onclick={() => void view.app.retryCover()} data-autofocus>重试</Button>
      </div>
    {/if}
  {/if}
{/snippet}

<input bind:this={input} type='file' accept='image/*' class='sr-only' tabindex='-1' aria-hidden='true' onchange={onfile} />
