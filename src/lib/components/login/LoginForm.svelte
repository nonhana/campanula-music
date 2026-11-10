<script lang="ts">
  import { flushSync } from 'svelte';

  import { getAppView } from '../shared/app-context.svelte';
  import type { Toward } from '../shared/motion';
  import { animateHeight, float } from '../shared/motion';
  import { DURATIONS, FLOAT_IN_DELAY } from '../shared/motion-tokens';
  import Segmented from '../ui/Segmented.svelte';
  import LoginQr from './LoginQr.svelte';
  import LoginSms from './LoginSms.svelte';

  interface Props {
    phone: boolean;
  }

  const { phone }: Props = $props();
  const view = getAppView();

  type Method = 'qr' | 'sms';
  // svelte-ignore state_referenced_locally
  let method = $state<Method>(phone ? 'sms' : 'qr');
  const methods = $derived<{ key: Method; label: string }[]>(
    phone
      ? [
          { key: 'sms', label: '短信验证码' },
          { key: 'qr', label: '扫码' },
        ]
      : [
          { key: 'qr', label: '扫码' },
          { key: 'sms', label: '短信验证码' },
        ],
  );

  $effect(() => {
    if (method !== 'qr') return;
    void view.app.startQrLogin();
    return () => view.app.stopQrLogin();
  });

  let panel = $state<HTMLElement>();
  let resizing: Animation | undefined;
  let toward = $state<Toward>('left');
  const choose = (next: Method, focus = false) => {
    if (next !== method) switchTo(next);
    if (focus)
      queueMicrotask(() =>
        document.getElementById(`login-${next}-tab`)?.focus(),
      );
  };

  const switchTo = (next: Method) => {
    const order = methods.map((item) => item.key);
    const from = panel!.getBoundingClientRect().height;
    resizing?.cancel();
    toward = order.indexOf(next) > order.indexOf(method) ? 'left' : 'right';
    method = next;
    flushSync();
    // 正在飘走的那块是 inert；连着来回切时留下的可能还是原来那块
    const incoming = [...panel!.children].find(
      (child) => !(child as HTMLElement).inert,
    ) as HTMLElement;
    const to =
      incoming.offsetHeight +
      Number.parseFloat(getComputedStyle(panel!).paddingTop);
    resizing = animateHeight(panel!, from, to, DURATIONS.panel) ?? undefined;
  };
</script>

<div>
  <Segmented
    options={methods}
    value={method}
    onchange={(key) => choose(key)}
    role="tab"
    id="login"
    label="登录方式"
    class="h-11"
  />

  <!-- items-start：两块各按各的高度，才量得出新的那块有多高 -->
  <div
    bind:this={panel}
    id="login-{method}"
    role="tabpanel"
    aria-labelledby="login-{method}-tab"
    class="grid grid-cols-[minmax(0,1fr)] items-start pt-6"
  >
    {#key method}
      <div
        class="col-start-1 row-start-1 min-w-0"
        transition:float={{ toward, panel: true, delay: FLOAT_IN_DELAY }}
      >
        {#if method === 'qr'}
          <LoginQr {phone} onswitch={() => choose('sms', true)} />
        {:else}
          <LoginSms onswitch={() => choose('qr', true)} />
        {/if}
      </div>
    {/key}
  </div>
</div>
