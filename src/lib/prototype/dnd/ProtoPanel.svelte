<!--
  PROTOTYPE：原型面板（只在原型里有）。左边调参数，右边看结果：每次请求的名字、大小、耗时，排序是怎么合并成一次提交的。
  桌面是右侧浮动卡片，手机是底部弹层。参数只在内存里，刷新恢复默认。
-->
<script lang='ts'>
  import type { TestFileKind } from './cover/image'
  import type { CommitOutcome, RemoveStyle, UploadOutcome, UploadSpeed } from './settings.svelte'
  import { X } from '@lucide/svelte'
  import { fly } from 'svelte/transition'
  import { api } from './api.svelte'
  import { formatBytes, formatCount } from './data'
  import { layout } from './layout.svelte'
  import { settings } from './settings.svelte'
  import { dragStats, engineNames, library, tracksOf, ui, variantNames, view } from './store.svelte'

  interface Props {
    /** 封面页：把测试文件交给封面流程 */
    onTestFile?: (kind: TestFileKind) => void
  }

  const { onTestFile }: Props = $props()

  const tracks = $derived(tracksOf(view.pl))
  const commit = $derived(view.screen === 'library' ? library.ownCommit : tracks.commit)
  let now = $state(Date.now())

  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 200)
    return () => clearInterval(t)
  })

  const commitText = $derived.by(() => {
    switch (commit.status) {
      case 'waiting': return `等待合并：${Math.max(0, (commit.dueAt - now) / 1000).toFixed(1)} 秒后提交`
      case 'saving': return '正在提交'
      case 'failed': return '上次提交失败，已回滚'
      default: return '没有待提交的改动'
    }
  })

  const hint: Record<string, string> = {
    'A': '手机：长按一行，浮起后接着拖就是排序，松手就进入多选。桌面：按住一行直接拖。',
    'B': '手机：按住右侧把手立即拖；长按一行进入多选。桌面：按住左侧把手拖。',
    'C': '先点“多选 · 排序”进入编辑模式，再按住把手拖；长按一行也能进入。',
  }

  function jump(n: number) {
    const host = document.querySelector<HTMLElement>('[aria-label="歌单里的歌曲"]')
    if (!host)
      return
    const top = host.getBoundingClientRect().top + window.scrollY + (n - 1) * 56 - layout.topInset - 56 * 2
    window.scrollTo({ top })
    if (layout.phone)
      ui.panel = false
  }

  const commitOutcomes: { key: CommitOutcome, label: string }[] = [{ key: 'ok', label: '成功' }, { key: 'fail', label: '失败（看回滚）' }]
  const removeStyles: { key: RemoveStyle, label: string }[] = [{ key: 'undo', label: '直接移除 + 撤销' }, { key: 'confirm', label: '先确认' }]
  const uploadOutcomes: { key: UploadOutcome, label: string }[] = [
    { key: 'ok', label: '全部成功' },
    { key: 'fail-alloc', label: '第 1 步失败' },
    { key: 'fail-upload', label: '第 2 步中途断' },
    { key: 'fail-set', label: '第 3 步失败' },
  ]
  const uploadSpeeds: { key: UploadSpeed, label: string }[] = [{ key: 'fast', label: '快' }, { key: 'normal', label: '一般' }, { key: 'slow', label: '很慢' }]
  const testFiles: { key: TestFileKind, label: string }[] = [
    { key: 'landscape', label: '横图 1600×900' },
    { key: 'portrait', label: '竖图 900×1600' },
    { key: 'huge', label: '超大尺寸 8000×6000' },
    { key: 'too-big', label: '超过 20 MB' },
    { key: 'tiny', label: '很小 200×200' },
    { key: 'heic', label: 'HEIC 照片' },
    { key: 'text', label: '不是图片的文件' },
  ]
</script>

{#snippet seg<T extends string>(options: { key: T, label: string }[], value: T, set: (v: T) => void, label: string)}
  <div class='seg flex flex-wrap gap-1' role='radiogroup' aria-label={label}>
    {#each options as o (o.key)}
      <button type='button' role='radio' aria-checked={value === o.key} class={['h-8 rounded-full px-3 text-[12.5px] font-500', value === o.key ? 'bg-primary-200 text-primary-950' : 'border border-neutral-200 bg-white text-neutral-700']} onclick={() => set(o.key)}>{o.label}</button>
    {/each}
  </div>
{/snippet}

{#snippet slider(label: string, value: number, min: number, max: number, step: number, unit: string, set: (v: number) => void)}
  <label class='block'>
    <span class='flex items-baseline justify-between text-[12.5px] text-neutral-700'>{label}<span class='text-neutral-900 tnum'>{value}{unit}</span></span>
    <input type='range' class='mt-1 w-full' {min} {max} {step} {value} oninput={e => set(Number(e.currentTarget.value))} />
  </label>
{/snippet}

{#snippet body()}
  <div class='flex flex-col gap-5 text-neutral-900'>
    {#if view.route === 'dnd'}
      <section class='flex flex-col gap-2'>
        <h3 class='text-[13px] font-600'>现在试的是</h3>
        <p class='text-[13px] leading-5 text-neutral-700'>方案 {view.variant}「{variantNames[view.variant]}」· 实现「{engineNames[view.engine]}」</p>
        <p class='text-[12.5px] leading-5 text-neutral-600'>{hint[view.variant]}</p>
        {#if view.screen === 'playlist'}
          <div class='flex flex-wrap gap-1.5 pt-1'>
            <button type='button' class='h-8 rounded-full border border-neutral-200 bg-white px-3 text-[12.5px] font-500 text-neutral-800' onclick={() => jump(10)}>滚到第 10 首</button>
            <button type='button' class='h-8 rounded-full border border-neutral-200 bg-white px-3 text-[12.5px] font-500 text-neutral-800' onclick={() => jump(3000)}>滚到第 3,000 首</button>
          </div>
        {/if}
        {#if dragStats.last}
          <p class='rounded-lg bg-primary-50 px-3 py-2 text-[12.5px] leading-5 text-primary-950 tnum'>最近一次：{dragStats.last}</p>
        {/if}
      </section>
    {/if}

    <section class='flex flex-col gap-2.5'>
      <h3 class='text-[13px] font-600'>假的网易云接口</h3>
      {@render seg(commitOutcomes, settings.commitOutcome, v => (settings.commitOutcome = v), '接口结果')}
      {@render slider('每次请求的往返', settings.latency, 100, 3000, 100, ' ms', v => (settings.latency = v))}
      {#if view.route === 'dnd'}
        {@render slider('拖完等多久再提交（期间再拖就合并）', settings.mergeDelay, 0, 5000, 250, ' ms', v => (settings.mergeDelay = v))}
        <p class='rounded-lg bg-neutral-50 px-3 py-2 text-[12.5px] leading-5 text-neutral-700 tnum'>
          {commitText}<br />改了 {commit.touched} 次，真正提交 {commit.sent} 次
        </p>
      {/if}
    </section>

    {#if view.route === 'dnd'}
      <section class='flex flex-col gap-2.5'>
        <h3 class='text-[13px] font-600'>手势</h3>
        {@render slider('长按多久算长按', settings.longPress, 200, 800, 50, ' ms', v => (settings.longPress = v))}
        {@render seg(removeStyles, settings.removeStyle, v => (settings.removeStyle = v), '批量移除')}
      </section>

      <section class='flex flex-col gap-2.5'>
        <h3 class='text-[13px] font-600'>拖到边缘的自动滚动</h3>
        {@render slider('最高速度', settings.maxSpeed, 400, 4000, 100, ' px/秒', v => (settings.maxSpeed = v))}
        <p class='-mt-1 text-[12px] leading-[18px] text-neutral-500'>三种实现都用这个值。下面三项只有“自写”有。</p>
        {@render slider('停在边缘最多加速到', settings.accel, 1, 10, 0.5, ' 倍', v => (settings.accel = v))}
        {@render slider('几秒加速到最大', settings.accelTime, 0.5, 6, 0.5, ' 秒', v => (settings.accelTime = v))}
        {@render slider('边缘区高度', settings.zone, 40, 160, 8, ' px', v => (settings.zone = v))}
        <label class='flex items-center gap-2 text-[13px] text-neutral-800'>
          <input type='checkbox' bind:checked={settings.scrubber} />拖到右侧窄条上快速定位
        </label>
      </section>
    {:else}
      <section class='flex flex-col gap-2.5'>
        <h3 class='text-[13px] font-600'>上传</h3>
        {@render seg(uploadOutcomes, settings.uploadOutcome, v => (settings.uploadOutcome = v), '上传结果')}
        {@render seg(uploadSpeeds, settings.uploadSpeed, v => (settings.uploadSpeed = v), '上传速度')}
      </section>
      {#if onTestFile}
        <section class='flex flex-col gap-2'>
          <h3 class='text-[13px] font-600'>用测试文件换封面</h3>
          <p class='text-[12px] leading-[18px] text-neutral-500'>和从相册里选一样走完整流程；真机上也可以直接点封面选真的照片。</p>
          <div class='flex flex-wrap gap-1.5'>
            {#each testFiles as f (f.key)}
              <button type='button' class='h-8 rounded-full border border-neutral-200 bg-white px-3 text-[12.5px] font-500 text-neutral-800' onclick={() => { ui.panel = false; onTestFile(f.key) }}>{f.label}</button>
            {/each}
          </div>
        </section>
      {/if}
    {/if}

    <section class='flex flex-col gap-2'>
      <h3 class='text-[13px] font-600'>请求记录 <span class='font-400 text-neutral-500 tnum'>· 共 {formatCount(api.count)} 次</span></h3>
      {#if api.log.length === 0}
        <p class='text-[12.5px] text-neutral-500'>还没有请求。</p>
      {:else}
        <ol class='flex flex-col gap-1.5'>
          {#each api.log.slice(0, 10) as c (c.id)}
            <li class='rounded-lg bg-neutral-50 px-3 py-2 text-[12px] leading-[18px]'>
              <span class='flex items-center gap-2'>
                <span class={['size-2 flex-none rounded-full', c.status === 'ok' ? 'bg-primary-700' : c.status === 'pending' ? 'bg-warning-500' : c.status === 'aborted' ? 'bg-neutral-400' : 'bg-error-700']} aria-hidden='true'></span>
                <span class='min-w-0 flex-1 truncate font-500 text-neutral-900'>{c.name}</span>
                <span class='flex-none text-neutral-500 tnum'>{c.status === 'pending' ? '进行中' : c.status === 'ok' ? `${c.ms} ms` : c.status === 'aborted' ? '已取消' : '失败'}</span>
              </span>
              <span class='block truncate pl-4 text-neutral-600 tnum'>{c.detail} · 约 {formatBytes(c.bytes)}</span>
            </li>
          {/each}
        </ol>
      {/if}
    </section>
  </div>
{/snippet}

{#if ui.panel}
  {#if layout.phone}
    <div class='fixed inset-0 z-[9995]' role='presentation'>
      <button class='absolute inset-0 bg-neutral-900/30' aria-label='关闭原型面板' tabindex='-1' onclick={() => (ui.panel = false)}></button>
      <div class='absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-float' role='dialog' aria-label='原型面板' transition:fly={{ y: 400, duration: 280, opacity: 1 }}>
        <div class='mb-3 flex items-center justify-between'>
          <h2 class='text-[15px] font-600'>原型面板</h2>
          <button class='grid size-10 place-items-center rounded-full text-neutral-600' aria-label='关闭原型面板' onclick={() => (ui.panel = false)}><X size={18} /></button>
        </div>
        {@render body()}
      </div>
    </div>
  {:else}
    <aside class='fixed bottom-24 right-4 top-20 z-[9995] w-[340px] overflow-y-auto rounded-2xl bg-white p-4 shadow-float' aria-label='原型面板' transition:fly={{ x: 24, duration: 200 }}>
      <div class='mb-3 flex items-center justify-between'>
        <h2 class='text-[15px] font-600'>原型面板</h2>
        <button class='grid size-9 place-items-center rounded-full text-neutral-600' aria-label='关闭原型面板' onclick={() => (ui.panel = false)}><X size={18} /></button>
      </div>
      {@render body()}
    </aside>
  {/if}
{/if}
