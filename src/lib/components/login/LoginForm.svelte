<!--
  登录表单（登录页里的登录卡片）：扫码、短信验证码两种方式，随时切换。桌面默认扫码，手机默认短信验证码。
  显示扫码时 App 查询扫码状态；切走或离开登录页就停止查询。
  换方式时按标签的左右顺序横着走：往右边的标签换，旧的往左飘出、新的从右边飘进来（DESIGN.md Motion · 方向）；
  上面的切换条是 ui/Segmented（标签页），选中那格下面的滑块跟着横着滑；
  两种方式不一样高，卡片跟着变高变矮（面板 360ms）
-->
<script lang='ts'>
  import type { Toward } from '../shared/motion'
  import { flushSync } from 'svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { animateHeight, float } from '../shared/motion'
  import { DURATIONS, FLOAT_IN_DELAY } from '../shared/motion-tokens'
  import Segmented from '../ui/Segmented.svelte'
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

  let panel = $state<HTMLElement>()
  /** 卡片正在跟着变高变矮 */
  let resizing: Animation | undefined
  /** 这次换方式往哪边走：往右边的标签换时内容往左走 */
  let toward = $state<Toward>('left')
  /** 换登录方式；focus：把焦点放到选中的那个方式上（从说明里的“改用……”切换时，原来的焦点会消失） */
  function choose(next: Method, focus = false) {
    if (next !== method)
      switchTo(next)
    if (focus)
      queueMicrotask(() => document.getElementById(`login-${next}-tab`)?.focus())
  }

  /**
   * 新旧两种方式叠在同一格里，旧的飘走以前格子按高的那个算：高度从现在的样子变到新的那个（不动布局的例外），
   * 变的这一会儿竖着超出的部分裁掉（横着飘的不裁）
   */
  function switchTo(next: Method) {
    const order = methods.map(item => item.key)
    const from = panel!.getBoundingClientRect().height
    resizing?.cancel()
    toward = order.indexOf(next) > order.indexOf(method) ? 'left' : 'right'
    method = next
    flushSync()
    // 正在飘走的那块 Svelte 标成 inert；连着来回切时留下来的可能是原来那块
    const incoming = [...panel!.children].find(child => !(child as HTMLElement).inert) as HTMLElement
    const to = incoming.offsetHeight + Number.parseFloat(getComputedStyle(panel!).paddingTop)
    resizing = animateHeight(panel!, from, to, DURATIONS.panel) ?? undefined
  }
</script>

<div>
  <Segmented options={methods} value={method} onchange={key => choose(key)} role='tab' id='login' label='登录方式' class='h-11' />

  <!-- 新旧两种方式叠在同一格里横着走；各按各的高度（items-start），量得出新的那个有多高 -->
  <div bind:this={panel} id='login-{method}' role='tabpanel' aria-labelledby='login-{method}-tab' class='grid grid-cols-[minmax(0,1fr)] items-start pt-6'>
    {#key method}
      <div class='col-start-1 row-start-1 min-w-0' transition:float={{ toward, panel: true, delay: FLOAT_IN_DELAY }}>
        {#if method === 'qr'}
          <LoginQr {phone} onswitch={() => choose('sms', true)} />
        {:else}
          <LoginSms onswitch={() => choose('qr', true)} />
        {/if}
      </div>
    {/key}
  </div>
</div>
