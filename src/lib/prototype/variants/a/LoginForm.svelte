<!--
  PROTOTYPE：登录表单（介绍页里用）。扫码 / 短信验证码两种方式；桌面默认扫码，手机默认短信，?login= 覆盖。
  扫码：等待扫码 → 已扫码，请在手机上确认（?demo=loading）→ 二维码已过期，点击刷新（?demo=error）。
  短信：+86 手机号，获取验证码后 60 秒倒计时，填验证码登录。原型不联网：登录只是切到已登录的曲库。
-->
<script lang='ts'>
  import { nav } from '$lib/prototype/nav.svelte'
  import { LoaderCircle, RotateCw, ShieldCheck, Smartphone } from '@lucide/svelte'
  import LoginQr, { qrFile } from './LoginQr.svelte'

  interface Props {
    phone: boolean
  }

  const { phone }: Props = $props()

  const method = $derived(nav.login || (phone ? 'sms' : 'qr'))
  const qrState = $derived(nav.demo === 'loading' ? 'scanned' : nav.demo === 'error' ? 'expired' : 'waiting')

  // ---------- 短信 ----------
  let tel = $state('')
  let code = $state('')
  let left = $state(0)
  let sentTo = $state('')
  let telError = $state('')
  let codeError = $state('')
  let submitting = $state(false)
  let codeInput = $state<HTMLInputElement>()

  const telOk = $derived(/^1\d{10}$/.test(tel))
  const busy = $derived(submitting || (method === 'sms' && nav.demo === 'loading'))
  const shownCodeError = $derived(codeError || (method === 'sms' && nav.demo === 'error' ? '验证码不对或已过期，请重新获取' : ''))

  $effect(() => {
    if (left <= 0)
      return
    const id = setTimeout(() => (left -= 1), 1000)
    return () => clearTimeout(id)
  })

  function onTel(e: Event & { currentTarget: HTMLInputElement }) {
    tel = e.currentTarget.value.replace(/\D/g, '').slice(0, 11)
    e.currentTarget.value = tel
    telError = ''
  }

  function onCode(e: Event & { currentTarget: HTMLInputElement }) {
    code = e.currentTarget.value.replace(/\D/g, '').slice(0, 6)
    e.currentTarget.value = code
    codeError = ''
  }

  function sendCode() {
    if (!telOk) {
      telError = tel ? '手机号是 11 位数字，以 1 开头' : '先填手机号'
      return
    }
    sentTo = `+86 ${tel.slice(0, 3)} **** ${tel.slice(7)}`
    left = 60
    codeInput?.focus()
  }

  function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!telOk) {
      telError = tel ? '手机号是 11 位数字，以 1 开头' : '先填手机号'
      return
    }
    if (code.length < 4) {
      codeError = sentTo ? '填写收到的短信验证码' : '先获取验证码'
      return
    }
    submitting = true
    setTimeout(() => {
      nav.auth = 'in'
      nav.goLibrary('liked')
    }, 900)
  }

  function refreshQr() {
    nav.demo = ''
  }

  const qrHref = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrFile)}`

  const methods = [
    { key: 'qr', label: '扫码' },
    { key: 'sms', label: '短信验证码' },
  ] as const
  const order = $derived(phone ? [methods[1], methods[0]] : methods)

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')
      return
    e.preventDefault()
    nav.login = method === 'qr' ? 'sms' : 'qr'
    queueMicrotask(() => (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-selected="true"]')?.focus())
  }
</script>

<div class={['login', phone && 'is-phone']}>
  <div class={['seg flex rounded-full bg-primary-50 p-1', phone ? 'h-12' : 'h-11']} role='tablist' aria-label='登录方式' tabindex='-1' onkeydown={onTabKey}>
    {#each order as m (m.key)}
      {@const active = method === m.key}
      <button
        role='tab'
        id='login-tab-{m.key}'
        aria-selected={active}
        aria-controls='login-panel'
        tabindex={active ? 0 : -1}
        class={['flex-1 rounded-full font-500 transition-colors duration-150', phone ? 'text-[15px]' : 'text-[14px]', active ? 'bg-primary-200 text-primary-950' : 'seg-item text-neutral-600']}
        onclick={() => (nav.login = m.key)}
      >{m.label}</button>
    {/each}
  </div>

  <div id='login-panel' role='tabpanel' aria-labelledby='login-tab-{method}' class={phone ? 'pt-5' : 'pt-6'}>
    {#if method === 'qr'}
      <div class='flex flex-col items-center'>
        <div class={['relative rounded-2xl border border-neutral-100 bg-white', phone ? 'p-3.5' : 'p-4']}>
          <LoginQr class={['block transition-[filter,opacity] duration-300', phone ? 'size-[184px]' : 'size-[176px]', qrState !== 'waiting' && 'opacity-15 blur-[1.5px]']} />
          {#if qrState === 'scanned'}
            <div class='absolute inset-0 grid place-items-center text-center'>
              <div class='flex flex-col items-center'>
                <span class='grid size-12 place-items-center rounded-full bg-primary-100 text-primary-900'>
                  <Smartphone size={22} aria-hidden='true' />
                </span>
                <span class='mt-2.5 text-[14px] font-500 text-neutral-900'>已扫码</span>
              </div>
            </div>
          {:else if qrState === 'expired'}
            <button class='refresh absolute inset-0 grid place-items-center rounded-2xl text-center' onclick={refreshQr}>
              <span class='flex flex-col items-center'>
                <span class='grid size-12 place-items-center rounded-full bg-primary-900 text-white'>
                  <RotateCw size={20} aria-hidden='true' />
                </span>
                <span class='mt-2.5 text-[14px] font-500 text-neutral-900'>点击刷新</span>
              </span>
            </button>
          {/if}
        </div>

        <p class='mt-4 flex items-center gap-2 text-[14px] leading-5' role='status'>
          {#if qrState === 'waiting'}
            <span class='qr-dot size-2 rounded-full bg-primary-700' aria-hidden='true'></span>
            <span class='font-500 text-neutral-900'>等待扫码</span>
          {:else if qrState === 'scanned'}
            <LoaderCircle size={15} class='spin text-primary-800' aria-hidden='true' />
            <span class='font-500 text-neutral-900'>已扫码，请在手机上确认</span>
          {:else}
            <span class='font-500 text-error-700'>二维码已过期，点击刷新</span>
          {/if}
        </p>
        <p class='hint mt-1 text-center text-[13px] leading-5 text-neutral-600'>
          {#if phone}
            保存二维码到相册，<br />用网易云音乐 App 的“扫一扫”从相册识别
          {:else}
            打开网易云音乐 App，<br />用“扫一扫”扫描上面的二维码
          {/if}
        </p>
        {#if phone}
          <a
            class='mt-4 inline-flex h-11 items-center rounded-full bg-secondary-100 px-5 text-[15px] font-500 text-secondary-900 active:bg-secondary-200'
            href={qrHref}
            download='campanula-登录二维码.svg'
          >保存二维码</a>
        {/if}
      </div>
    {:else}
      <form class='flex flex-col' novalidate onsubmit={submit}>
        <label for='login-tel' class='text-[13px] font-500 text-neutral-700'>手机号</label>
        <div class={['field mt-1.5 flex items-center rounded-full border bg-white', phone ? 'h-12' : 'h-11', telError ? 'border-error-700' : 'border-neutral-200']}>
          <span class='flex h-5 flex-none items-center border-r border-neutral-200 pl-4 pr-3 text-[15px] text-neutral-900 tnum' aria-hidden='true'>+86</span>
          <input
            id='login-tel'
            class='min-w-0 flex-1 bg-transparent px-3 text-[15px] text-neutral-900 outline-none tnum placeholder:text-neutral-500'
            type='tel'
            inputmode='numeric'
            autocomplete='tel-national'
            placeholder='11 位手机号'
            aria-label='手机号（+86）'
            aria-invalid={telError ? 'true' : undefined}
            aria-describedby={telError ? 'login-tel-err' : undefined}
            value={tel}
            oninput={onTel}
          />
        </div>
        {#if telError}<p id='login-tel-err' class='mt-1.5 pl-4 text-[13px] text-error-700'>{telError}</p>{/if}

        <label for='login-code' class={['text-[13px] font-500 text-neutral-700', phone ? 'mt-4' : 'mt-3.5']}>验证码</label>
        <div class='mt-1.5 flex gap-2'>
          <input
            bind:this={codeInput}
            id='login-code'
            class={['field min-w-0 flex-1 rounded-full border bg-white px-4 text-[15px] text-neutral-900 outline-none tnum placeholder:text-neutral-500', phone ? 'h-12' : 'h-11', shownCodeError ? 'border-error-700' : 'border-neutral-200']}
            inputmode='numeric'
            autocomplete='one-time-code'
            placeholder='短信验证码'
            aria-invalid={shownCodeError ? 'true' : undefined}
            aria-describedby={shownCodeError ? 'login-code-err' : sentTo ? 'login-sent' : undefined}
            value={code}
            oninput={onCode}
          />
          <button
            type='button'
            class={['btn-line flex-none rounded-full border border-neutral-200 bg-white px-4 text-[14px] font-500 tnum disabled:text-neutral-500', phone ? 'h-12 w-[124px]' : 'h-11 w-[120px]', 'text-primary-900']}
            disabled={left > 0}
            onclick={sendCode}
          >{left > 0 ? `${left} 秒后重发` : sentTo ? '重新获取' : '获取验证码'}</button>
        </div>
        {#if shownCodeError}
          <p id='login-code-err' class='mt-1.5 pl-4 text-[13px] text-error-700'>{shownCodeError}</p>
        {:else if sentTo}
          <p id='login-sent' class='mt-1.5 pl-4 text-[13px] text-neutral-600 tnum' role='status'>验证码已发到 {sentTo}</p>
        {/if}

        <button
          type='submit'
          class={['filled mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-primary-900 font-500 text-white disabled:cursor-progress', phone ? 'h-12 text-[16px]' : 'h-11 text-[15px]']}
          disabled={busy}
        >
          {#if busy}<LoaderCircle size={17} class='spin' aria-hidden='true' />正在登录{:else}登录{/if}
        </button>
      </form>
    {/if}
  </div>

  <p class={['flex gap-2.5 border-t border-neutral-100 text-[13px] leading-5 text-neutral-600', phone ? 'mt-5 pt-4' : 'mt-6 pt-5']}>
    <ShieldCheck size={16} class='mt-0.5 flex-none text-primary-800' aria-hidden='true' />
    <span>登录凭据加密后只保存在这个浏览器里，服务器不保存。Campanula 是开源软件（MIT），可以查看源代码确认。</span>
  </p>
</div>

<style>
  .field:focus-within,
  input.field:focus {
    border-color: #59cfa3;
  }

  .field[aria-invalid='true']:focus,
  .field:has([aria-invalid='true']):focus-within {
    border-color: #d32f2f;
  }

  .qr-dot {
    animation: qr-dot 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }

  @keyframes qr-dot {
    0% {
      box-shadow: 0 0 0 0 rgb(55 190 140 / 0.45);
    }
    70%,
    100% {
      box-shadow: 0 0 0 7px rgb(55 190 140 / 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .qr-dot {
      animation: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .seg-item:hover {
      color: #111827;
    }

    .filled:not(:disabled):hover {
      background: #1a5b43;
    }

    .btn-line:not(:disabled):hover {
      background: #e8f8f1;
      color: #1a5b43;
      border-color: #b9ead5;
    }

    .refresh:hover span span:first-child {
      background: #1a5b43;
    }
  }
</style>
