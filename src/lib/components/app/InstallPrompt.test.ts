import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InstallPrompt from './InstallPrompt.svelte'

const INSTALL_HINT_KEY = 'campanula.installHint'

/** 构造可派发的 beforeinstallprompt 事件（非标准事件，测试侧注入 prompt 方法） */
function installPromptEvent(prompt: () => Promise<void>): Event {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  Object.defineProperty(event, 'prompt', { value: prompt })
  return event
}

function mockUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('installPrompt', () => {
  it('未触发安装事件时不呈现安装提示', () => {
    render(InstallPrompt)
    expect(screen.queryByRole('region', { name: '安装提示' })).toBeNull()
  })

  it('触发 beforeinstallprompt 后呈现安装提示与安装按钮', async () => {
    render(InstallPrompt)
    await fireEvent(window, installPromptEvent(() => Promise.resolve()))
    expect(screen.getByRole('region', { name: '安装提示' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '安装' })).toBeTruthy()
  })

  it('点击安装调用系统安装 prompt，完成后提示消失', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    render(InstallPrompt)
    await fireEvent(window, installPromptEvent(prompt))

    await fireEvent.click(screen.getByRole('button', { name: '安装' }))

    expect(prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: '安装提示' })).toBeNull()
  })

  it('安装完成后（appinstalled）提示消失', async () => {
    render(InstallPrompt)
    await fireEvent(window, installPromptEvent(() => Promise.resolve()))

    await fireEvent(window, new Event('appinstalled'))

    expect(screen.queryByRole('region', { name: '安装提示' })).toBeNull()
  })

  it('iOS（无系统安装事件）：呈现手动添加主屏提示', () => {
    mockUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    )
    render(InstallPrompt)
    expect(screen.getByRole('region', { name: 'iOS 安装提示' })).toBeTruthy()
    expect(screen.getByText(/分享.*添加到主屏幕/)).toBeTruthy()
  })

  it('iOS 提示已读后不再呈现（偏好写入 localStorage）', async () => {
    mockUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    )
    render(InstallPrompt)
    await fireEvent.click(screen.getByRole('button', { name: '知道了' }))
    expect(localStorage.getItem(INSTALL_HINT_KEY)).toBe('1')

    cleanup()
    render(InstallPrompt)
    expect(screen.queryByRole('region', { name: 'iOS 安装提示' })).toBeNull()
  })
})
