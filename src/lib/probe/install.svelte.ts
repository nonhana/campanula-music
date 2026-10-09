import { logPage } from './log'

/**
 * Chrome 觉得能安装时会发 beforeinstallprompt；它可能在探针页挂载之前就到了，
 * 所以在模块加载时就开始听，存下来给“安装”按钮用。
 */
export const install = $state<{ prompt: BeforeInstallPromptEvent | null, installed: boolean }>({ prompt: null, installed: false })

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    install.prompt = event
    logPage('install', '收到 beforeinstallprompt', { platforms: event.platforms })
  })
  window.addEventListener('appinstalled', () => {
    install.installed = true
    install.prompt = null
    logPage('install', '收到 appinstalled')
  })
}
