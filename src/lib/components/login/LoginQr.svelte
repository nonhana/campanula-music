<!--
  扫码登录（视觉原型 welcome-qr / scanned / expired）：等待扫码 → 已扫码，在手机上确认 → 登录；
  二维码过期点码上的刷新图标；取不到、查不到时给出原因，能重试。取码中、等扫码时状态行只有转圈、跳动的小点，读屏文字留在状态行里。
  网易云要求行为验证（8821）时换成验证用的二维码，听众在手机上验证完点“继续登录”（确认时按钮转圈）。
  手机上扫不了自己屏幕上的码：把二维码存进相册，用网易云 App 的“扫一扫”从相册识别。
  各步骤之间交叉淡化（DESIGN.md Motion）：骨架 ↔ 二维码、刷新出来的新码、盖在码上的头像和刷新键、码下面的状态和说明；
  “还没有通过验证”、下面的按钮推开内容时展开、收起（motion.ts 的 unfold）
-->
<script lang='ts'>
  import { LoaderCircle, RotateCw } from '@lucide/svelte'

  import Avatar from '../account/Avatar.svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { failureText } from '../shared/failure'
  import { fade, unfold } from '../shared/motion'
  import Button from '../ui/Button.svelte'

  interface Props {
    /** 手机布局：二维码要存进相册再识别 */
    phone: boolean
    /** 改用短信验证码 */
    onswitch: () => void
  }

  const { phone, onswitch }: Props = $props()
  const view = getAppView()
  const qr = $derived(view.state.login.qr)
  const image = $derived(qr && 'image' in qr
    ? qr.image
    : undefined)
  const verifying = $derived(qr?.step === 'verifying')
  const dimmed = $derived(qr?.step === 'scanned' || qr?.step === 'expired')
  const size = $derived(phone ? 'size-[200px]' : 'size-[192px]')
  /** 码下面那段说明说的是哪一种：换的时候交叉淡化 */
  const hint = $derived(qr?.step === 'failed'
    ? 'failed'
    : verifying ? 'verifying' : 'scan')

  let box = $state<HTMLElement>()
  /**
   * 刷新、重试时按钮会消失又出现：焦点原来在这里的，放回这一块（还有按钮就放到按钮上），键盘不会丢了位置。
   * 正在淡出的按钮（Svelte 标成 inert）不算
   */
  const refresh = async () => {
    const hadFocus = box?.contains(document.activeElement) ?? false
    await view.app.startQrLogin()
    if (hadFocus)
      (box?.querySelector<HTMLElement>('button:not([inert])') ?? box)?.focus()
  }
</script>

<div class='flex flex-col items-center'>
  <div bind:this={box} tabindex='-1' class='relative border border-neutral-100 rounded-xl bg-white p-1'>
    <!-- 撑开大小；骨架、二维码都叠在它上面，彼此交叉淡化 -->
    <span class={['block', size]} aria-hidden='true'></span>
    {#if image}
      <!-- global：码第一次到时这一块跟着外面的 if 一起建出来，也要从骨架上淡进来；刷新出来的新码和旧码交叉淡化 -->
      {#key image}
        <span class='absolute inset-1' transition:fade|global>
          <!-- SDK 给的是黑白 PNG：盖一层森林墨、用 lighten 混合，黑色模块变成森林墨，白底不变 -->
          <img
            src={image}
            alt={verifying ? '安全验证二维码' : '登录二维码'}
            class={['block [image-rendering:pixelated] transition-[filter,opacity] duration-state', size, dimmed && 'opacity-15 blur-[1.5px]']}
          />
          <span class='pointer-events-none absolute inset-0 bg-primary-950 mix-blend-lighten' aria-hidden='true'></span>
        </span>
      {/key}
    {:else}
      <span class={[
        'absolute inset-1 rounded-lg',
        qr?.step === 'loading'
          ? 'bone'
          : 'bg-neutral-100',
      ]} aria-hidden='true' transition:fade></span>
    {/if}

    {#if qr?.step === 'scanned'}
      <span class='absolute inset-0 grid place-items-center text-center' transition:fade>
        <span class='flex flex-col items-center'>
          <Avatar url={qr.avatarUrl} size={48} class='ring-2 ring-white' />
          <span class='mt-2.5 max-w-40 truncate text-label text-neutral-900 font-500'>{qr.nickname}</span>
        </span>
      </span>
    {:else if qr?.step === 'expired' || qr?.step === 'failed'}
      <button
        type='button'
        class='group absolute inset-0 grid place-items-center rounded-xl'
        aria-label={qr.step === 'expired'
          ? '刷新二维码'
          : '重试'}
        onclick={refresh}
        transition:fade
      >
        <span class='grid size-12 place-items-center rounded-full bg-primary-900 text-white transition-colors duration-feedback mouse:group-hover:bg-primary-950'>
          <RotateCw size={20} aria-hidden='true' />
        </span>
      </button>
    {/if}
  </div>

  <div class='mt-4 max-w-[300px] flex flex-col items-center text-center'>
    <!-- 新旧两行叠在同一格里交叉淡化；只有转圈、小点的那两步也占一行高（h-5），换字时不跳 -->
    <p class='grid grid-cols-[minmax(0,1fr)] justify-items-center text-label' role='status'>
      {#key qr?.step ?? 'loading'}
        <span class='col-start-1 row-start-1 h-5 flex items-center gap-2' transition:fade>
          {#if !qr || qr.step === 'loading'}
            <LoaderCircle size={15} class='animate-spin text-primary-800' aria-hidden='true' />
            <span class='sr-only'>正在获取二维码</span>
          {:else if qr.step === 'waiting'}
            <span class='qr-dot size-2 rounded-full bg-current text-primary-600' aria-hidden='true'></span>
            <span class='sr-only'>等待扫码</span>
          {:else if qr.step === 'scanned'}
            <LoaderCircle size={15} class='animate-spin text-primary-800' aria-hidden='true' />
            <span class='text-neutral-900 font-500'>在手机上确认</span>
          {:else if qr.step === 'expired'}
            <span class='text-error-700 font-500'>二维码已过期</span>
          {:else if qr.step === 'failed'}
            <span class='text-error-700 font-500'>扫码登录没成功</span>
          {:else}
            <span class='text-neutral-900 font-500'>需要先完成安全验证</span>
          {/if}
        </span>
      {/key}
    </p>

    <div class='grid grid-cols-[minmax(0,1fr)] justify-items-center'>
      {#key hint}
        <div class='col-start-1 row-start-1 flex flex-col items-center' transition:fade>
          {#if hint === 'failed' && qr?.step === 'failed'}
            <p class='[text-wrap:pretty] mt-1 text-caption text-neutral-600'>{failureText(qr.failure)}</p>
            <button type='button' class='mt-1 rounded-sm text-caption text-primary-900 font-500 underline-offset-2 mouse:hover:underline' onclick={onswitch}>改用短信验证码</button>
          {:else if hint === 'verifying'}
            <p class='mt-1 text-caption text-neutral-600'>
              {#if phone}
                存进相册，用网易云音乐 App“扫一扫”识别，在手机上验证
              {:else}
                用网易云音乐 App 扫码，在手机上验证
              {/if}
            </p>
          {:else}
            <p class='mt-1 text-caption text-neutral-600'>
              {#if phone}
                存进相册，<br />用网易云音乐 App“扫一扫”识别
              {:else}
                用网易云音乐 App 扫码
              {/if}
            </p>
          {/if}
        </div>
      {/key}
    </div>
    {#if qr?.step === 'verifying' && qr.unverified}
      <div transition:unfold>
        <p class='pt-1 text-caption text-error-700' role='alert'>还没有通过验证</p>
      </div>
    {/if}
  </div>

  {#if (phone && image && qr?.step !== 'expired') || verifying}
    <div transition:unfold>
      <div class='flex flex-wrap justify-center gap-2 pt-4'>
        {#if phone && image && qr?.step !== 'expired'}
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- data: 地址的图片，下载用，不是页面 -->
          <a href={image}
             download={verifying ? 'campanula-安全验证二维码.png' : 'campanula-登录二维码.png'}
             class='pill-hit h-10 inline-flex items-center rounded-full bg-secondary-100 px-5 text-label text-secondary-900 font-500 transition-colors duration-feedback active:bg-secondary-200 mouse:hover:bg-secondary-200'
          >保存二维码</a>
        {/if}
        {#if qr?.step === 'verifying'}
          <Button variant='primary' busy={qr.checking} onclick={() => void view.app.continueQrLogin()}>继续登录</Button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* 等待扫码的小点：新芽绿（只做装饰，DESIGN.md），一圈圈向外淡开；颜色取自元素的 currentColor */
  .qr-dot {
    animation: qr-dot var(--loop-qr-dot) var(--ease-out-soft) infinite;
    animation-play-state: var(--loop-state);
  }

  @keyframes qr-dot {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 45%, transparent);
    }
    70%,
    100% {
      box-shadow: 0 0 0 7px transparent;
    }
  }
</style>
