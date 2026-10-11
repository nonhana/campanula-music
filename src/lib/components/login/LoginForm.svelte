<!--
  登录表单（未登录页里的登录卡片）：扫码、短信验证码两种方式，随时切换。桌面默认扫码，手机默认短信验证码。
  显示扫码时 App 查询扫码状态；切走或离开登录页就停止查询。
-->
<script lang='ts'>
  import { ShieldCheck } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import LoginQr from './LoginQr.svelte'
  import LoginSms from './LoginSms.svelte'

  interface Props {
    /** 手机布局：默认短信验证码，二维码要存进相册再识别 */
    phone: boolean
  }

  const { phone }: Props = $props()
  const view = getAppView()

  type Method = 'qr' | 'sms'
  // 只在打开登录页时按布局选默认方式；之后窗口变宽变窄，这一份表单不重新挂载，听众选的方式不变
  // svelte-ignore state_referenced_locally
  let method = $state<Method>(phone ? 'sms' : 'qr')
  const methods = $derived<{ key: Method, label: string }[]>(phone
    ? [{ key: 'sms', label: '短信验证码' }, { key: 'qr', label: '扫码' }]
    : [{ key: 'qr', label: '扫码' }, { key: 'sms', label: '短信验证码' }])

  $effect(() => {
    if (method !== 'qr')
      return
    void view.app.startQrLogin()
    return () => view.app.stopQrLogin()
  })

  let tabs = $state<HTMLElement>()
  /** 换登录方式；focus：把焦点放到选中的那个方式上（键盘切换、从说明里的“改用……”切换时，原来的焦点会消失） */
  function choose(next: Method, focus = false) {
    method = next
    if (focus)
      queueMicrotask(() => tabs?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus())
  }

  /** 方向键在两个方式之间切换，焦点跟着走（WAI-ARIA Tabs） */
  function onTabKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
      return
    event.preventDefault()
    choose(method === 'qr' ? 'sms' : 'qr', true)
  }
</script>

<div>
  <div bind:this={tabs} class='h-11 flex rounded-full bg-primary-50 p-1' role='tablist' aria-label='登录方式' tabindex='-1' onkeydown={onTabKey}>
    {#each methods as item (item.key)}
      {@const active = method === item.key}
      <button
        type='button'
        role='tab'
        id='login-tab-{item.key}'
        aria-selected={active}
        aria-controls='login-panel'
        tabindex={active ? 0 : -1}
        class={[
          'flex-1 rounded-full text-label font-500 transition-colors duration-150',
          active ? 'bg-primary-200 text-primary-950' : 'text-neutral-600 mouse:hover:text-neutral-900',
        ]}
        onclick={() => choose(item.key)}
      >{item.label}</button>
    {/each}
  </div>

  <div id='login-panel' role='tabpanel' aria-labelledby='login-tab-{method}' class='pt-6'>
    {#if method === 'qr'}
      <LoginQr {phone} onswitch={() => choose('sms', true)} />
    {:else}
      <LoginSms onswitch={() => choose('qr', true)} />
    {/if}
  </div>

  <p class='mt-6 flex gap-2.5 border-t border-neutral-100 pt-5 text-caption text-neutral-600'>
    <ShieldCheck size={16} class='mt-0.5 flex-none text-primary-800' aria-hidden='true' />
    <span>登录凭据加密后只保存在这个浏览器里，服务器不保存。Campanula 是开源软件（MIT），可以查看源代码确认。</span>
  </p>
</div>
