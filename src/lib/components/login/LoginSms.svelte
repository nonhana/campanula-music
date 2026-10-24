<!--
  短信验证码登录（视觉原型 welcome-sms）：+86 手机号，获取验证码后 60 秒才能重发，填验证码登录。
  发不出去、登录被拒时给出原因；网易云因为风控拒绝时原样显示它的说明，听众可以改用扫码。
  发送、登录时按钮不换字，转圈（busy）。这些报错推开下面的登录键：出现时展开，走时淡出再收起（motion.ts 的 unfold）
-->
<script lang='ts'>
  import { captchaProblem, phoneProblem } from '#lib/api/login.js'

  import { getAppView } from '../shared/app-context.svelte'
  import { failureText } from '../shared/failure'
  import { unfold } from '../shared/motion'
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
  const waitSeconds = $derived(captchaStatus.status === 'sent'
    ? Math.max(0, Math.ceil((captchaStatus.resendAt - now) / 1000))
    : 0)

  const masked = (value: string) => `+86 ${value.slice(0, 3)} **** ${value.slice(7)}`

  const onPhoneInput = () => {
    phone = phone.replace(/\D/g, '').slice(0, 11)
    phoneError = ''
  }

  const onCaptchaInput = () => {
    captcha = captcha.replace(/\D/g, '').slice(0, 6)
    captchaError = ''
  }

  const phoneOk = (): boolean => {
    const problem = phoneProblem(phone)
    phoneError = problem === 'phoneEmpty'
      ? '先填手机号'
      : problem ? '手机号是 11 位数字，以 1 开头' : ''
    if (phoneError)
      phoneInput?.focus()
    return !phoneError
  }

  const sendCaptcha = async () => {
    if (!phoneOk())
      return
    const target = phone
    await view.app.sendCaptcha(target)
    if (view.state.login.sms.captcha.status === 'sent') {
      sentTo = target
      captchaInput?.focus()
    }
  }

  const login = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!phoneOk())
      return
    if (captchaProblem(captcha)) {
      captchaError = captchaStatus.status === 'sent'
        ? '填写收到的短信验证码'
        : '先获取验证码'
      captchaInput?.focus()
      return
    }
    await view.app.loginWithCaptcha(phone, captcha)
  }

  const captchaHint = $derived(
    captchaStatus.status === 'sent' && sentTo
      ? `验证码已发到 ${masked(sentTo)}`
      : undefined,
  )
  const sendLabel = $derived(waitSeconds > 0
    ? `${waitSeconds} 秒后重发`
    : sentTo ? '重新获取' : '获取验证码')
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
    oninput={onCaptchaInput}
  >
    {#snippet action()}
      <Button
        variant='outline'
        class='w-[124px] tabular-nums h-11!'
        busy={captchaStatus.status === 'sending'}
        disabled={waitSeconds > 0}
        onclick={() => void sendCaptcha()}
      >{sendLabel}</Button>
    {/snippet}
  </TextField>

  {#if captchaStatus.status === 'failed'}
    <div transition:unfold>
      <p class='pt-1.5 text-caption text-error-700' role='alert'>验证码没发出去：{failureText(captchaStatus.failure)}</p>
    </div>
  {/if}

  {#if submit.status === 'failed'}
    <div transition:unfold>
      <div class='pt-4 text-caption text-error-700' role='alert'>
        <p>没登录上：{failureText(submit.failure)}</p>
        {#if submit.failure.kind === 'rejected'}
          <button type='button' class='mt-1 rounded-sm text-primary-900 font-500 underline underline-offset-2' onclick={onswitch}>改用扫码</button>
        {/if}
      </div>
    </div>
  {/if}

  <Button type='submit' variant='primary' class='mt-5 w-full h-11!' busy={submit.status === 'submitting'}>登录</Button>
</form>
