<script lang='ts'>
  import type { NcmBindingStatus } from '$lib/types'
  import { resolve } from '$app/paths'
  import { runBindingCheck } from '$lib/binding'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { fetchBindingStatus, unbind } from '$lib/ncm/binding'
  import SkinSelector from '$lib/skin/SkinSelector.svelte'
  import SoundLevelSelector from '$lib/soundLevel/SoundLevelSelector.svelte'
  import { Loader } from '@lucide/svelte'
  import { onMount } from 'svelte'

  const metadata = generateSeoMetadata('settings')

  let accountStatus = $state<NcmBindingStatus | null>(null)
  /** null 两义拆分：loading = 首查未归，error = 查询失败，二者文案不同 */
  let accountLoading = $state(true)
  let accountError = $state(false)
  let unbinding = $state(false)
  let confirmingUnbind = $state(false)
  let unbindError = $state<string | null>(null)

  const refreshAccount = async () => {
    accountLoading = true
    accountError = false
    try {
      accountStatus = await fetchBindingStatus()
      unbindError = null
    }
    catch {
      accountStatus = null
      accountError = true
    }
    finally {
      accountLoading = false
    }
  }

  onMount(() => {
    void refreshAccount()
  })

  /**
   * 解绑采用两步确认：首次点击进入确认态，再次点击才执行。
   * 确认后删除本机凭据，全局心跳编排自然回到绑定引导页。
   */
  const requestUnbind = () => {
    confirmingUnbind = true
  }

  const cancelUnbind = () => {
    confirmingUnbind = false
    unbindError = null
  }

  const handleUnbind = async () => {
    unbinding = true
    unbindError = null
    try {
      await unbind()
      confirmingUnbind = false
      await runBindingCheck()
    }
    catch {
      unbindError = '解绑失败，请稍后再试'
    }
    finally {
      unbinding = false
    }
  }
</script>

<SeoHead {metadata} />

<section class='space-y-8'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>设置</h1>
  </header>

  <div class='space-y-3'>
    <h2 class='text-base text-app-text font-medium'>皮肤</h2>
    <SkinSelector />
  </div>

  <div class='space-y-3'>
    <h2 class='text-base text-app-text font-medium'>音质档位</h2>
    <SoundLevelSelector />
  </div>

  <div class='space-y-3'>
    <h2 class='text-base text-app-text font-medium'>账号</h2>
    {#if accountLoading}
      <p class='text-sm text-app-text-muted'>账号状态加载中…</p>
    {:else if accountError || accountStatus === null}
      <p class='text-sm text-app-text-muted'>账号状态获取失败，请稍后重试。</p>
    {:else if accountStatus.status === 'valid'}
      <div class='flex items-center justify-between gap-4 border border-app-border rounded-xl bg-app-surface p-4'>
        <div class='min-w-0'>
          <p class='truncate text-app-text font-medium'>{accountStatus.user.nickname || '未知昵称'}</p>
          <p class='mt-0.5 text-xs text-app-text-muted'>UID {accountStatus.user.uid}</p>
        </div>
        {#if confirmingUnbind}
          <div class='flex shrink-0 items-center gap-2'>
            <span class='text-xs text-app-text-muted'>清除本机凭据？</span>
            <button
              type='button'
              disabled={unbinding}
              onclick={handleUnbind}
              class='flex items-center gap-2 rounded-lg bg-error-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-error-700 disabled:opacity-50'
            >
              {#if unbinding}
                <Loader class='size-4 animate-spin' />
              {/if}
              确认解绑
            </button>
            <button
              type='button'
              disabled={unbinding}
              onclick={cancelUnbind}
              class='rounded-lg px-2 py-1.5 text-sm text-app-text-muted hover:bg-neutral-100 disabled:opacity-50'
            >
              取消
            </button>
          </div>
        {:else}
          <button
            type='button'
            onclick={requestUnbind}
            class='flex shrink-0 items-center gap-2 border border-error-200 rounded-lg px-3 py-1.5 text-sm text-error-700 transition-colors hover:bg-error/5'
          >
            重新绑定
          </button>
        {/if}
      </div>
      {#if unbindError}
        <p role='alert' class='text-sm text-error-700'>{unbindError}</p>
      {/if}
    {:else}
      <a
        href={resolve('/bind')}
        class='flex items-center justify-between border border-app-border rounded-xl bg-app-surface p-4 text-sm transition-colors hover:bg-app-surface-hover'
      >
        <span class='text-app-text'>{accountStatus.status === 'invalid' ? '绑定已失效，请重新扫码' : '尚未绑定网易云账号'}</span>
        <span class='text-primary-700 font-medium'>去绑定</span>
      </a>
    {/if}
  </div>
</section>
