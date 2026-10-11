<!-- 打开时没问到当前账号：说清是断网、连不上、服务端出错，还是 Campanula 自己出了错，都能重试 -->
<script lang='ts'>
  import type { CheckFailure } from '$lib/app/app'
  import Brand from './Brand.svelte'
  import StateBlock from './ui/StateBlock.svelte'

  interface Props {
    /** appError：App 自己的缺陷（没想到的错误），不是网络或服务端的问题 */
    reason: CheckFailure | 'appError'
    onretry: () => void
  }

  const { reason, onretry }: Props = $props()

  const message = {
    offline: {
      title: '网络已断开',
      body: 'Campanula 要联网才能确认你有没有登录。连上网络后点“重试”。',
    },
    unreachable: {
      title: '连不上 Campanula 的服务器',
      body: '可能是网络不稳定，也可能是服务器暂时停了。稍后点“重试”；一直这样的话，请告诉站长。',
    },
    serverError: {
      title: 'Campanula 的服务器出错了',
      body: '稍后点“重试”；一直这样的话，请告诉站长。',
    },
    appError: {
      title: 'Campanula 出错了',
      body: '这是 Campanula 自己的问题，不是网络的问题。点“重试”；一直这样的话，请告诉站长。',
    },
  } satisfies Record<Props['reason'], { title: string, body: string }>
</script>

<div class='bg-primary-50 min-h-dvh'>
  <header class='mx-auto h-14 max-w-[1280px] flex items-center px-4 md:h-16 md:px-8'>
    <Brand />
  </header>
  <main class='pt-[8vh]'>
    <StateBlock kind='error' title={message[reason].title} body={message[reason].body} action={{ label: '重试', run: onretry }} />
  </main>
</div>
