<!--
  PROTOTYPE：换封面的三种流程（?variant= 切换），都从点封面 / “更多 → 更换封面”开始，选图后：
    A 单独的裁剪页：全屏（桌面是大弹窗）裁剪，点“使用”后在同一页里显示三步上传的进度，可以取消（回到裁剪）；成功才关闭。
    B 自动居中，可再调整：不打开裁剪页，直接按居中裁成正方形开始上传，封面上一圈进度；
      上传中的提示条里有“调整”（停下上传，打开裁剪弹层），成功后的提示条里有“撤销”（改回旧封面，也要告诉网易云）。
    C 弹层里原地裁剪：底部弹层（桌面是弹窗）里同时显示裁剪框、上传进度和结果，一直不离开歌单页。
  共同的边界：不是图片、超过 20 MB、HEIC 打不开、很小的图提示会糊、超大图先缩到 3200px 再裁；三步各自失败；中途取消。
  第 3 步（设为封面）已经发给服务器，取消不了。
  选文件用 <input type=file accept=image/*>（Android 上会打开系统相册 / 照片选择器）。
-->
<script lang='ts'>
  import type { Crop, CoverError, Picked, TestFileKind } from './image'
  import { CircleAlert, Image as ImageIcon, RotateCcw, TriangleAlert, X } from '@lucide/svelte'
  import { fade, fly } from 'svelte/transition'
  import { formatBytes } from '../data'
  import { layout } from '../layout.svelte'
  import { netease } from '../api.svelte'
  import { dismissToast, library, toast, ui, view } from '../store.svelte'
  import Cropper from './Cropper.svelte'
  import { centerCrop, errorText, exportJpeg, OUTPUT_SIZE, readImage } from './image'
  import { failText, stepLabels, UploadJob } from './pipeline.svelte'
  import { coverUpload } from './state.svelte'
  import { makeTestFile } from './testFiles'

  const phone = $derived(layout.phone)
  const variant = $derived(view.coverVariant)
  const pl = $derived(library.byId(view.pl))

  let input = $state<HTMLInputElement>()
  /** 'idle' | 'reading' | 'crop'（在裁剪）| 'upload'（裁剪页 / 弹层里显示上传）| 'error'（文件不能用） */
  let phase = $state<'idle' | 'reading' | 'crop' | 'upload' | 'error'>('idle')
  let picked = $state.raw<Picked | null>(null)
  let crop = $state<Crop>({ x: 0, y: 0, size: 1 })
  let fileError = $state<CoverError | null>(null)
  let job = $state<UploadJob | null>(null)
  let exported = $state<{ bytes: number, quality: number, url: string } | null>(null)
  /** 方案 B：上传前的旧封面，撤销时改回去 */
  let previous: string | undefined
  /** 方案 B：“正在上传”的那条提示，传完（成功、失败、取消）就收起 */
  let bgToast = 0
  let viewport = $state({ w: 390, h: 844 })

  function measureViewport() {
    viewport = { w: window.innerWidth, h: window.innerHeight }
  }

  $effect(() => {
    measureViewport()
    window.addEventListener('resize', measureViewport)
    return () => window.removeEventListener('resize', measureViewport)
  })

  // 弹层开着时，原型切换栏缩到角上（不挡弹层底部的按钮），方向键留给裁剪框
  $effect(() => {
    ui.coverOpen = phase !== 'idle'
    return () => (ui.coverOpen = false)
  })

  /** 裁剪框边长：手机按屏宽，桌面固定 */
  const boxA = $derived(phone ? Math.min(viewport.w - 48, viewport.h - 300) : 420)
  const boxC = $derived(phone ? Math.min(viewport.w - 96, 300) : 320)

  export function pick() {
    if (job?.busy) {
      toast('封面还在上传，等它传完或先取消。')
      return
    }
    input?.click()
  }

  export async function useTestFile(kind: TestFileKind) {
    if (job?.busy) {
      toast('封面还在上传，等它传完或先取消。')
      return
    }
    phase = 'reading'
    const file = await makeTestFile(kind)
    await accept(file)
  }

  async function onchange(e: Event) {
    const el = e.currentTarget as HTMLInputElement
    const file = el.files?.[0]
    el.value = ''
    if (file)
      await accept(file)
  }

  function reset() {
    if (picked) {
      picked.bitmap.close()
      URL.revokeObjectURL(picked.url)
    }
    picked = null
    fileError = null
    job = null
    exported = null
    phase = 'idle'
  }

  async function accept(file: File) {
    reset()
    phase = 'reading'
    const r = await readImage(file)
    if (!r.ok) {
      fileError = r.error
      phase = 'error'
      return
    }
    picked = r.picked
    crop = centerCrop(r.picked.width, r.picked.height)
    if (variant === 'B') {
      phase = 'idle'
      await startUpload({ background: true })
      return
    }
    phase = 'crop'
  }

  async function startUpload(opts: { background: boolean }) {
    if (!picked || !pl)
      return
    const { blob, quality } = await exportJpeg(picked.bitmap, crop)
    if (exported)
      URL.revokeObjectURL(exported.url)
    exported = { bytes: blob.size, quality, url: URL.createObjectURL(blob) }
    const j = new UploadJob(pl.id, blob)
    job = j
    if (opts.background) {
      previous = library.covers[pl.id]
      coverUpload.background = j
      bgToast = toast('正在上传新封面（已自动居中裁成正方形）', { duration: 120_000, action: { label: '调整', run: adjustFromBackground } })
    }
    else {
      phase = 'upload'
    }
    await finish(j, opts.background)
  }

  /** 跑完（或重试）一次上传，按结果收尾；中途换了别的图、点了“调整”（job 变了）就什么都不做 */
  async function finish(j: UploadJob, background: boolean) {
    const ok = await j.run()
    if (job !== j)
      return
    if (background) {
      coverUpload.background = null
      dismissToast(bgToast)
    }
    if (ok && exported && pl) {
      library.covers[pl.id] = exported.url
      if (background) {
        toast('封面已更新', { action: { label: '撤销', run: undoCover } })
        cleanupKeepCover()
      }
      else {
        toast('封面已更新')
        // A 的裁剪页、B 的“调整”传完就关；C 留在弹层里给听众看结果
        if (variant !== 'C')
          closeAll(true)
      }
      return
    }
    if (background && j.state === 'failed')
      toast(failText(j), { tone: 'error', duration: 8000, action: { label: '重试', run: () => retryBackground(j) } })
  }

  /** 方案 B：停下后台上传，打开裁剪弹层 */
  function adjustFromBackground() {
    if (!job || !picked)
      return
    // 第 3 步已经发给服务器，停不下来：这时候打开裁剪，网易云那边会换上封面，这边却以为没换
    if (job.busy && !job.cancelable) {
      toast('图片已经传上去了，正在设为封面；好了以后可以再点封面换一次。')
      return
    }
    job.cancel()
    coverUpload.background = null
    dismissToast(bgToast)
    job = null
    phase = 'crop'
  }

  async function retryBackground(j: UploadJob) {
    if (job !== j)
      return
    coverUpload.background = j
    bgToast = toast('正在重新上传新封面', { duration: 120_000, action: { label: '调整', run: adjustFromBackground } })
    await finish(j, true)
  }

  /** 方案 B 的撤销也是一次写操作：先改回本地，再告诉网易云；失败就把新封面放回来（ADR-0007） */
  async function undoCover() {
    if (!pl)
      return
    const id = pl.id
    const now = library.covers[id]
    if (previous)
      library.covers[id] = previous
    else delete library.covers[id]
    try {
      await netease.playlistCoverRevert(id)
      toast('已改回原来的封面')
    }
    catch {
      if (now)
        library.covers[id] = now
      toast('没能改回原来的封面，新封面还在。', { tone: 'error' })
    }
  }

  /** 上传成功后：只清掉裁剪用的东西，保留新封面的 blob 地址 */
  function cleanupKeepCover() {
    if (picked) {
      picked.bitmap.close()
      URL.revokeObjectURL(picked.url)
    }
    picked = null
    exported = null
    job = null
    phase = 'idle'
  }

  function closeAll(keepCover = false) {
    if (job?.cancelable)
      job.cancel()
    if (keepCover)
      cleanupKeepCover()
    else reset()
  }

  /** 弹层里的“取消”：上传中先停上传，回到裁剪；没在上传就关掉 */
  function back() {
    if (phase === 'upload' && job?.cancelable) {
      job.cancel()
      phase = 'crop'
      job = null
      return
    }
    if (phase === 'upload' && job?.state === 'set')
      return
    closeAll()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && phase !== 'idle') {
      e.preventDefault()
      back()
    }
  }

  async function useCrop() {
    await startUpload({ background: false })
  }

  /** 弹层里的“重试”：只重做失败的那一步之后的部分（第 3 步失败时不重新上传） */
  async function retryForeground() {
    if (job)
      await finish(job, false)
  }

  const steps = ['alloc', 'upload', 'set'] as const

  function stepState(s: typeof steps[number]): 'done' | 'now' | 'todo' | 'fail' {
    if (!job)
      return 'todo'
    const order = { alloc: 0, upload: 1, set: 2 }
    const cur = job.state === 'done' ? 3 : job.state === 'failed' ? order[job.failedStep ?? 'alloc'] : job.state in order ? order[job.state as keyof typeof order] : 0
    if (job.state === 'failed' && order[s] === cur)
      return 'fail'
    if (order[s] < cur)
      return 'done'
    if (order[s] === cur && job.state !== 'failed')
      return 'now'
    return 'todo'
  }

  const smallNote = $derived(picked?.small ? `这张图只有 ${picked.origWidth}×${picked.origHeight}，放大成封面可能会糊。` : '')
  const hugeNote = $derived(picked && Math.max(picked.origWidth, picked.origHeight) > 3200 ? `原图 ${picked.origWidth}×${picked.origHeight}，已先缩小再裁剪（${picked.ms} ms）。` : '')
</script>

<svelte:window {onkeydown} />

<input bind:this={input} type='file' accept='image/*' class='sr-only' tabindex='-1' aria-hidden='true' {onchange} />

{#snippet progressBlock()}
  {#if job}
    <ol class='flex flex-col gap-2' aria-label='上传进度'>
      {#each steps as s (s)}
        {@const st = stepState(s)}
        <li class='flex items-center gap-2.5 text-[14px]'>
          <span class={['grid size-5 flex-none place-items-center rounded-full text-[11px] font-600', st === 'done' ? 'bg-primary-900 text-white' : st === 'now' ? 'bg-primary-100 text-primary-950 ring-2 ring-primary-700' : st === 'fail' ? 'bg-error-50 text-error-700 ring-2 ring-error-700' : 'bg-neutral-100 text-neutral-500']} aria-hidden='true'>
            {steps.indexOf(s) + 1}
          </span>
          <span class={st === 'todo' ? 'text-neutral-500' : st === 'fail' ? 'text-error-700' : 'text-neutral-900'}>{stepLabels[s]}</span>
          {#if s === 'upload' && st === 'now'}
            <span class='ml-auto text-[13px] text-neutral-600 tnum'>{Math.round(((job.progress - 0.1) / 0.8) * 100)}%</span>
          {:else if st === 'done'}
            <span class='ml-auto text-[13px] text-neutral-500'>完成</span>
          {/if}
        </li>
      {/each}
    </ol>
    <div class='mt-3 h-1.5 overflow-hidden rounded-full bg-primary-100' role='progressbar' aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(job.progress * 100)} aria-label='上传进度'>
      <div class={['h-full rounded-full transition-[width] duration-150', job.state === 'failed' ? 'bg-error-700' : 'bg-primary-700']} style:width='{job.progress * 100}%'></div>
    </div>
    {#if job.state === 'failed'}
      <p class='mt-3 flex items-start gap-2 rounded-xl bg-error-50 px-3 py-2.5 text-[13px] leading-5 text-error-700' role='alert'>
        <CircleAlert size={16} class='mt-0.5 flex-none' aria-hidden='true' />{failText(job)}
      </p>
    {:else if job.state === 'set'}
      <p class='mt-3 text-[13px] leading-5 text-neutral-600'>图片已经上传，正在让网易云换上新封面。这一步已经发出去，不能取消了。</p>
    {/if}
    {#if exported}
      <p class='mt-2 text-[12px] leading-[18px] text-neutral-500 tnum'>导出 {OUTPUT_SIZE}×{OUTPUT_SIZE} JPEG · {formatBytes(exported.bytes)} · 质量 {exported.quality}</p>
    {/if}
  {/if}
{/snippet}

{#snippet notes()}
  {#if smallNote || hugeNote}
    <div class='flex flex-col gap-1.5'>
      {#if smallNote}<p class='flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2 text-[13px] leading-5 text-warning-900'><TriangleAlert size={16} class='mt-0.5 flex-none' aria-hidden='true' />{smallNote}</p>{/if}
      {#if hugeNote}<p class='text-[12px] leading-[18px] text-neutral-500 tnum'>{hugeNote}</p>{/if}
    </div>
  {/if}
{/snippet}

{#snippet actions(primaryLabel: string)}
  {#if phase === 'upload' && job}
    {#if job.state === 'failed'}
      <button class='btn-line h-11 rounded-full border border-neutral-200 bg-white px-5 text-[15px] font-500 text-neutral-800' onclick={() => { phase = 'crop'; job = null }}>重新裁剪</button>
      <button class='btn-solid inline-flex h-11 items-center gap-1.5 rounded-full bg-primary-900 pl-4 pr-5 text-[15px] font-500 text-white' onclick={retryForeground}>
        <RotateCcw size={16} aria-hidden='true' />重试
      </button>
    {:else if job.state === 'done'}
      <button class='btn-solid h-11 rounded-full bg-primary-900 px-6 text-[15px] font-500 text-white' onclick={() => closeAll(true)}>完成</button>
    {:else}
      <button class='btn-line h-11 rounded-full border border-neutral-200 bg-white px-5 text-[15px] font-500 text-neutral-800 disabled:opacity-50' disabled={!job.cancelable} onclick={back}>
        {job.cancelable ? '取消上传' : '正在设为封面'}
      </button>
    {/if}
  {:else}
    <button class='btn-line h-11 rounded-full border border-neutral-200 bg-white px-5 text-[15px] font-500 text-neutral-800' onclick={() => pick()}>换一张</button>
    <button class='btn-solid h-11 rounded-full bg-primary-900 px-6 text-[15px] font-500 text-white' onclick={useCrop}>{primaryLabel}</button>
  {/if}
{/snippet}

<!-- 读取中（超大图解码要一会儿） -->
{#if phase === 'reading'}
  <div class='fixed inset-0 z-[85] grid place-items-center bg-neutral-900/20' transition:fade={{ duration: 120 }}>
    <p class='rounded-2xl bg-white px-5 py-3 text-[14px] text-neutral-800 shadow-float' role='status'>正在读取图片…</p>
  </div>
{/if}

<!-- 文件不能用 -->
{#if phase === 'error' && fileError}
  {@const t = errorText(fileError)}
  <div class='fixed inset-0 z-[85]' role='presentation'>
    <button class='absolute inset-0 bg-neutral-900/35' aria-label='关闭' tabindex='-1' onclick={reset} transition:fade={{ duration: 160 }}></button>
    <div
      class={phone ? 'absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-6 pb-[calc(16px+env(safe-area-inset-bottom))] pt-5 shadow-float' : 'absolute left-1/2 top-1/2 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-6 pb-5 pt-5 shadow-float'}
      role='alertdialog'
      aria-modal='true'
      aria-labelledby='cover-err'
      transition:fly={{ y: phone ? 300 : 8, duration: 220, opacity: phone ? 1 : 0 }}
    >
      <span class='grid size-10 place-items-center rounded-full bg-error-50 text-error-700' aria-hidden='true'><ImageIcon size={20} /></span>
      <h2 id='cover-err' class='mt-3 text-[18px] leading-7 font-600 text-neutral-900'>{t.title}</h2>
      <p class='mt-1.5 text-[14px] leading-[22px] text-neutral-700'>{t.body}</p>
      <div class={['mt-6', phone ? 'grid gap-2' : 'flex justify-end gap-2']}>
        {#if phone}
          <button class='h-11 rounded-full bg-primary-900 text-[15px] font-500 text-white' data-autofocus onclick={() => pick()}>换一张图片</button>
          <button class='h-11 rounded-full border border-neutral-200 bg-white text-[15px] font-500 text-neutral-800' onclick={reset}>先不换</button>
        {:else}
          <button class='btn-line h-10 rounded-full border border-neutral-200 bg-white px-5 text-[14px] font-500 text-neutral-800' onclick={reset}>先不换</button>
          <button class='btn-solid h-10 rounded-full bg-primary-900 px-5 text-[14px] font-500 text-white' onclick={() => pick()}>换一张图片</button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- A：单独的裁剪页（手机全屏，桌面大弹窗）；B 的“调整”也用它 -->
{#if picked && (phase === 'crop' || phase === 'upload') && (variant === 'A' || variant === 'B')}
  <div class='fixed inset-0 z-[85]' role='presentation'>
    {#if phone}
      <div class='absolute inset-0 flex flex-col bg-primary-50' role='dialog' aria-modal='true' aria-labelledby='crop-title' transition:fly={{ y: 40, duration: 240 }}>
        <div class='flex h-14 flex-none items-center gap-1 px-1'>
          <button class='grid size-11 place-items-center rounded-full text-neutral-800 active:bg-primary-100' aria-label={phase === 'upload' && job?.cancelable ? '取消上传' : '关闭'} onclick={back}><X size={22} /></button>
          <h2 id='crop-title' class='flex-1 text-[16px] font-500 text-neutral-900'>{phase === 'upload' ? '正在换封面' : '裁剪封面'}</h2>
        </div>
        <div class='flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-6 pb-4 pt-2'>
          {#if phase === 'crop'}
            <Cropper src={picked.url} width={picked.width} height={picked.height} size={boxA} bleed={0} bind:crop />
            <p class='text-center text-[13px] leading-5 text-neutral-600'>拖动图片调整位置，两指捏合缩放。封面会裁成正方形。</p>
            <div class='w-full'>{@render notes()}</div>
          {:else}
            <img src={exported?.url} alt='新封面预览' class='rounded-2xl shadow-ambient' style:width='{Math.min(boxA, 240)}px' style:height='{Math.min(boxA, 240)}px' />
            <div class='w-full'>{@render progressBlock()}</div>
          {/if}
        </div>
        <div class='grid flex-none grid-cols-2 gap-2 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 [&>*:only-child]:col-span-2'>
          {@render actions('使用')}
        </div>
      </div>
    {:else}
      <button class='absolute inset-0 bg-neutral-900/35' aria-label='关闭' tabindex='-1' onclick={back} transition:fade={{ duration: 160 }}></button>
      <div class='pointer-events-none absolute inset-0 grid place-items-center p-6'>
        <div class='pointer-events-auto w-full max-w-[560px] rounded-2xl bg-white shadow-float' role='dialog' aria-modal='true' aria-labelledby='crop-title' transition:fly={{ y: 8, duration: 200 }}>
          <div class='flex items-center gap-3 px-6 pb-2 pt-5'>
            <h2 id='crop-title' class='flex-1 text-[18px] leading-7 font-600 text-neutral-900'>{phase === 'upload' ? '正在换封面' : '裁剪封面'}</h2>
            <button class='ghost grid size-9 place-items-center rounded-full text-neutral-600' aria-label='关闭' onclick={back}><X size={18} /></button>
          </div>
          <div class='flex flex-col items-center gap-4 px-6 pb-2 pt-2'>
            {#if phase === 'crop'}
              <Cropper src={picked.url} width={picked.width} height={picked.height} size={boxA} bleed={24} bind:crop />
              <p class='text-center text-[13px] leading-5 text-neutral-600'>拖动图片调整位置，滚轮或滑块缩放，方向键微调。封面会裁成正方形。</p>
              <div class='w-full'>{@render notes()}</div>
            {:else}
              <img src={exported?.url} alt='新封面预览' class='size-[220px] rounded-2xl shadow-ambient' />
              <div class='w-full'>{@render progressBlock()}</div>
            {/if}
          </div>
          <div class='flex items-center justify-end gap-2 px-6 pb-5 pt-4'>
            {@render actions('使用这张')}
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<!-- C：弹层里原地裁剪 + 上传 + 结果，一直留在歌单页 -->
{#if picked && (phase === 'crop' || phase === 'upload') && variant === 'C'}
  <div class='fixed inset-0 z-[85]' role='presentation'>
    <button class='absolute inset-0 bg-neutral-900/30' aria-label='关闭' tabindex='-1' onclick={back} transition:fade={{ duration: 160 }}></button>
    <div
      class={phone ? 'absolute inset-x-0 bottom-0 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2 shadow-float' : 'absolute left-1/2 top-1/2 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-6 pb-5 pt-5 shadow-float'}
      role='dialog'
      aria-modal='true'
      aria-labelledby='crop-title-c'
      transition:fly={{ y: phone ? 400 : 8, duration: phone ? 320 : 200, opacity: phone ? 1 : 0 }}
    >
      {#if phone}<div class='mx-auto mb-3 h-1 w-9 rounded-full bg-neutral-300' aria-hidden='true'></div>{/if}
      <div class='mb-3 flex items-center gap-3'>
        <h2 id='crop-title-c' class='flex-1 text-[17px] leading-7 font-600 text-neutral-900'>更换封面</h2>
        {#if !phone}<button class='ghost grid size-9 place-items-center rounded-full text-neutral-600' aria-label='关闭' onclick={back}><X size={18} /></button>{/if}
      </div>
      <div class='relative flex flex-col items-center'>
        <div class={phase === 'upload' ? 'pointer-events-none opacity-60' : ''}>
          <Cropper src={picked.url} width={picked.width} height={picked.height} size={boxC} bleed={phone ? 20 : 40} bleedY={12} bind:crop />
        </div>
      </div>
      <div class='mt-3'>
        {#if phase === 'crop'}
          {@render notes()}
        {:else}
          {@render progressBlock()}
        {/if}
      </div>
      <div class={['mt-4', phone ? 'grid grid-cols-2 gap-2 [&>*:only-child]:col-span-2' : 'flex justify-end gap-2']}>
        {@render actions('使用')}
      </div>
    </div>
  </div>
{/if}

<style>
  @media (hover: hover) and (pointer: fine) {
    .btn-line:hover {
      border-color: #b9ead5;
      background: #f5fcf9;
    }

    .btn-solid:hover {
      background: #1a5b43;
    }

    .ghost:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
