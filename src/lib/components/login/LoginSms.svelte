<!--
  短信验证码登录（视觉原型 welcome-sms）：+86 手机号，获取验证码后 60 秒才能重发，填验证码登录。
  发不出去、登录被拒时说明原因；网易云因为风控拒绝时原样显示它的说明，听众可以改用扫码。
  这些说明推开下面的登录键：出现时展开，走时淡出再收起（motion.ts 的 unfold）
-->
<script lang='ts'>
  import { LoaderCircle } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { failureText, loginFailureText } from '../failure'
  import { unfold } from '../motion'
  import Button from '../ui/Button.svelte'
  import TextField from '../ui/TextField.svelte'

  interface Props {
    /** 改用扫码 */
    onswitch: () => void
  }

  const { onswitch }: Props = $props()
  const view = getAppView()
  const captchaStatus = $derived(view.state.login.sms.captcha)
  const submit = $derived(view.state.login.sms.submit)

  let phone = $state('')
  let captcha = $state('')
  let phoneError = $state('')
  let captchaError = $state('')
  /** 验证码发到了哪个号码 */
  let sentTo = $state('')
  let phoneInput = $state<HTMLInputElement>()
  let captchaInput = $state<HTMLInputElement>()

  // 重发倒计时：每秒看一眼时间，到点就停
  let now = $state(Date.now())
  $effect(() => {
    if (captchaStatus.status !== 'sent')
      return
    const { resendAt } = captchaStatus
    now = Date.now()
    const id = setInterval(() => {
      now = Date.now()
      if (now >= resendAt)
        clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  })
  const waitSeconds = $derived(captchaStatus.status === 'sent' ? Math.max(0, Math.ceil((captchaStatus.resendAt - now) / 1000)) : 0)

  const masked = (value: string) => `+86 ${value.slice(0, 3)} **** ${value.slice(7)}`

  function onPhoneInput() {
    phone = phone.replace(/\D/g, '').slice(0, 11)
    phoneError = ''
  }

  function onCaptchaInput() {
    captcha = captcha.replace(/\D/g, '').slice(0, 6)
    captchaError = ''
  }

  function phoneOk(): boolean {
    phoneError = !phone ? '先填手机号' : /^1\d{10}$/.test(phone) ? '' : '手机号是 11 位数字，以 1 开头'
    if (phoneError)
      phoneInput?.focus()
    return !phoneError
  }

  async function sendCaptcha() {
    if (!phoneOk())
      return
    const target = phone
    await view.app.sendCaptcha(target)
    if (view.state.login.sms.captcha.status === 'sent') {
      sentTo = target
      captchaInput?.focus()
    }
  }

  async function login(event: SubmitEvent) {
    event.preventDefault()
    if (!phoneOk())
      return
    if (captcha.length < 4) {
      captchaError = captchaStatus.status === 'sent' ? '填写收到的短信验证码' : '先获取验证码'
      captchaInput?.focus()
      return
    }
    await view.app.loginWithCaptcha(phone, captcha)
  }

  const captchaHint = $derived(
    captchaStatus.status === 'sent' && sentTo ? `验证码已发到 ${masked(sentTo)}` : undefined,
  )
  const sendLabel = $derived(
    captchaStatus.status === 'sending'
      ? '正在发送'
      : waitSeconds > 0 ? `${waitSeconds} 秒后重发` : sentTo ? '重新获取' : '获取验证码',
  )
</script>

<form class='flex flex-col' novalidate onsubmit={login}>
  <TextField
    id='login-phone'
    label='手机号'
    prefix='+86'
    bind:value={phone}
    bind:input={phoneInput}
    error={phoneError || undefined}
    type='tel'
    inputmode='numeric'
    autocomplete='tel-national'
    placeholder='11 位手机号'
    oninput={onPhoneInput}
  />

  <TextField
    id='login-captcha'
    label='验证码'
    class='mt-4'
    bind:value={captcha}
    bind:input={captchaInput}
    error={captchaError || undefined}
    hint={captchaHint}
    inputmode='numeric'
    autocomplete='one-time-code'
    placeholder='短信验证码'
    oninput={onCaptchaInput}
  >
    {#snippet action()}
      <Button
        variant='outline'
        class='w-[124px] tabular-nums md:h-11'
        disabled={captchaStatus.status === 'sending' || waitSeconds > 0}
        onclick={() => void sendCaptcha()}
      >{sendLabel}</Button>
    {/snippet}
  </TextField>

  {#if captchaStatus.status === 'failed'}
    <div transition:unfold>
      <p class='pt-1.5 text-caption text-error-700' role='alert'>验证码没发出去。{loginFailureText(captchaStatus.failure)}</p>
    </div>
  {/if}

  {#if submit.status === 'failed'}
    <div transition:unfold>
      <div class='pt-4 text-caption text-error-700' role='alert'>
        <p>没登录上。{failureText(submit.failure)}</p>
        {#if submit.failure.kind === 'rejected'}
          <button type='button' class='mt-1 rounded-sm text-primary-900 font-500 underline underline-offset-2' onclick={onswitch}>改用扫码登录</button>
        {/if}
      </div>
    </div>
  {/if}

  <Button type='submit' variant='primary' class='mt-5 w-full md:h-11' disabled={submit.status === 'submitting'}>
    {#if submit.status === 'submitting'}<LoaderCircle size={17} class='animate-spin' aria-hidden='true' />正在登录{:else}登录{/if}
  </Button>
</form>
