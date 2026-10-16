<!--
  打开时没问到当前账号：说清是断网、连不上、服务端出错、网易云的问题，还是 Campanula 自己出了错，都能重试。
  站长没配密钥时根布局显示 CookieSecretRequired，不到这里
-->
<script lang='ts'>
  import type { RequestFailure } from '#lib/app/api.js'
  import Brand from './Brand.svelte'
  import { failureText } from './failure'
  import Scrollbar from './ui/Scrollbar.svelte'
  import StateBlock from './ui/StateBlock.svelte'

  interface Props {
    /** appError：App 自己的缺陷（没想到的错误），不是网络或服务端的问题 */
    failure: Exclude<RequestFailure, { kind: 'cookieSecretMissing' | 'needsLogin' }> | { kind: 'appError' }
    onretry: () => void
  }

  const { failure, onretry }: Props = $props()

  const message = $derived.by((): { title: string, body: string } => {
    switch (failure.kind) {
      case 'offline':
        return { title: '网络已断开', body: 'Campanula 要联网才能确认你有没有登录。连上网络后点“重试”。' }
      case 'unreachable':
        return { title: '连不上 Campanula 的服务器', body: '可能是网络不稳定，也可能是服务器暂时停了。稍后点“重试”；一直这样的话，请告诉站长。' }
      case 'serverError':
        return { title: 'Campanula 的服务器出错了', body: '稍后点“重试”；一直这样的话，请告诉站长。' }
      case 'appError':
        return { title: 'Campanula 出错了', body: '这是 Campanula 自己的问题，不是网络的问题。点“重试”；一直这样的话，请告诉站长。' }
      case 'neteaseUnavailable':
      case 'rateLimited':
      case 'upstreamChanged':
      case 'rejected':
        return { title: '没能向网易云确认你的登录', body: `${failureText(failure)}点“重试”再问一次。` }
      default: {
        const unhandled: never = failure
        throw new Error(`不认识的失败：${JSON.stringify(unhandled)}`)
      }
    }
  })
</script>

<div class='bg-primary-50 min-h-dvh'>
  <header class='mx-auto h-14 max-w-[1280px] flex items-center px-4 md:h-16 md:px-8'>
    <Brand />
  </header>
  <main class='pt-[8vh]'>
    <StateBlock kind='error' title={message.title} body={message.body} action={{ label: '重试', run: onretry }} />
  </main>
  <Scrollbar page={{ top: '0px', bottom: '0px' }} />
</div>
