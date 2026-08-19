import type { QrLoginStart } from '$lib/ncm/binding'
import { goto } from '$app/navigation'
import { clearBindingInvalid } from '$lib/binding'
import { fetchBindingStatus, fetchQrStatus, QR_POLL_INTERVAL, startQrLogin } from '$lib/ncm/binding'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './+page.svelte'

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}))

vi.mock('$lib/binding', () => ({
  clearBindingInvalid: vi.fn(),
}))

vi.mock('$lib/ncm/binding', async (importOriginal) => {
  const mod = await importOriginal<typeof import('$lib/ncm/binding')>()
  return {
    ...mod,
    fetchBindingStatus: vi.fn(),
    startQrLogin: vi.fn(),
    fetchQrStatus: vi.fn(),
  }
})

const mockedFetch = vi.mocked(fetchBindingStatus)
const mockedStart = vi.mocked(startQrLogin)
const mockedPoll = vi.mocked(fetchQrStatus)
const mockedGoto = vi.mocked(goto)
const mockedClear = vi.mocked(clearBindingInvalid)

const qrStart: QrLoginStart = {
  key: 'abc123',
  qrUrl: 'https://music.163.com/login?codekey=abc123',
  qrimg: 'data:image/png;base64,xxx',
}

beforeEach(() => {
  mockedFetch.mockReset()
  mockedStart.mockReset()
  mockedPoll.mockReset()
  mockedGoto.mockReset()
  mockedClear.mockReset()
  // 默认：未绑定 + 二维码就绪 + 轮询等待中（各用例按需覆盖）
  mockedFetch.mockResolvedValue({ status: 'unbound' })
  mockedStart.mockResolvedValue(qrStart)
  mockedPoll.mockResolvedValue({ status: 'waiting' })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('绑定引导页', () => {
  it('已绑定时不入绑定流程，直接回到应用', async () => {
    mockedFetch.mockResolvedValue({ status: 'valid', user: { uid: 1, nickname: 'a' } })

    render(Page)

    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/'))
    expect(mockedStart).not.toHaveBeenCalled()
  })

  it('尚未绑定：呈现首次绑定引导与二维码', async () => {
    render(Page)

    await waitFor(() => expect(screen.getByText('绑定网易云账号')).toBeTruthy())
    await waitFor(() => expect(screen.getByAltText('绑定二维码')).toBeTruthy())
    expect(screen.getByText('打开网易云 App，扫一扫即可登录绑定')).toBeTruthy()
  })

  it('绑定失效：呈现失效重绑引导', async () => {
    mockedFetch.mockResolvedValue({ status: 'invalid' })

    render(Page)

    await waitFor(() => expect(screen.getByText('绑定已失效')).toBeTruthy())
    expect(screen.getByText(/账号许可已失效/)).toBeTruthy()
  })

  it('状态检查失败：呈现错误与重试，重试成功后进入二维码流程', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('network down')).mockResolvedValue({ status: 'unbound' })

    render(Page)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    const retry = screen.getByRole('button', { name: /重试/ })
    fireEvent.click(retry)

    await waitFor(() => expect(screen.getByAltText('绑定二维码')).toBeTruthy())
  })

  it('二维码生成失败：呈现错误与重试，重试后重新生成', async () => {
    mockedStart.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(qrStart)

    render(Page)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /重试/ }))

    await waitFor(() => expect(mockedStart).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByAltText('绑定二维码')).toBeTruthy())
  })

  it('扫码确认：清除失效标记并进入应用', async () => {
    mockedPoll.mockResolvedValue({ status: 'confirmed' })

    render(Page)

    await waitFor(() => expect(mockedClear).toHaveBeenCalled())
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/'))
  })

  it('二维码过期：停止轮询并引导刷新，刷新后生成新二维码', async () => {
    mockedPoll.mockResolvedValue({ status: 'expired' })

    render(Page)

    await waitFor(() => expect(screen.getByText('二维码已过期')).toBeTruthy())
    expect(mockedPoll).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /刷新二维码/ }))

    await waitFor(() => expect(mockedStart).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByAltText('绑定二维码')).toBeTruthy())
  })

  it('轮询失败：呈现错误与重试，可重新生成二维码', async () => {
    mockedPoll.mockRejectedValueOnce(new Error('boom')).mockResolvedValue({ status: 'waiting' })

    render(Page)

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(mockedPoll).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /重试/ }))

    await waitFor(() => expect(mockedStart).toHaveBeenCalledTimes(2))
  })

  it('扫码状态机：已扫码显示确认提示，间隔轮询到确认后进入应用（fake timers）', async () => {
    mockedPoll.mockResolvedValueOnce({ status: 'scanned' }).mockResolvedValueOnce({ status: 'confirmed' })

    vi.useFakeTimers()
    render(Page)
    await vi.advanceTimersByTimeAsync(0)

    expect(screen.getByText('扫码成功，请在手机上确认登录')).toBeTruthy()

    await vi.advanceTimersByTimeAsync(QR_POLL_INTERVAL + 50)

    expect(mockedClear).toHaveBeenCalled()
    expect(mockedGoto).toHaveBeenCalledWith('/')
  })
})
