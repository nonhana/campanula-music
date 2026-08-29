import type { NcmBindingStatus } from '$lib/types'
import { runBindingCheck } from '$lib/binding'
import { fetchBindingStatus, unbind } from '$lib/ncm/binding'
import { currentSoundLevel } from '$lib/soundLevel/currentSoundLevel'
import { DEFAULT_SOUND_LEVEL, SOUND_LEVEL_STORAGE_KEY } from '$lib/soundLevel/levels'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './+page.svelte'

vi.mock('$lib/ncm/binding', () => ({
  fetchBindingStatus: vi.fn(),
  unbind: vi.fn(),
}))

vi.mock('$lib/binding', () => ({
  runBindingCheck: vi.fn(),
}))

const mockedStatus = vi.mocked(fetchBindingStatus)
const mockedUnbind = vi.mocked(unbind)
const mockedCheck = vi.mocked(runBindingCheck)

beforeEach(() => {
  mockedStatus.mockReset()
  mockedUnbind.mockReset()
  mockedCheck.mockReset()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  currentSoundLevel.set(DEFAULT_SOUND_LEVEL)
})

describe('设置页', () => {
  it('同时呈现「皮肤」「音质档位」与「账号」区块', () => {
    mockedStatus.mockResolvedValue({ status: 'unbound' })
    render(Page)

    expect(screen.getByRole('heading', { name: '设置' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '皮肤' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: '皮肤' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '音质档位' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: '音质档位' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '账号' })).toBeTruthy()
  })

  it('绑定有效时显示昵称与 uid，并提供重新绑定入口', async () => {
    const status: NcmBindingStatus = { status: 'valid', user: { uid: 98765, nickname: '风铃草' } }
    mockedStatus.mockResolvedValue(status)
    render(Page)

    await waitFor(() => expect(screen.getByText('风铃草')).toBeTruthy())
    expect(screen.getByText('UID 98765')).toBeTruthy()
    expect(screen.getByRole('button', { name: '重新绑定' })).toBeTruthy()
  })

  it('未绑定或失效时显示绑定入口链接', async () => {
    mockedStatus.mockResolvedValue({ status: 'unbound' })
    render(Page)

    await waitFor(() => expect(screen.getByRole('link', { name: /去绑定/ })).toBeTruthy())
    expect(screen.getByRole('link', { name: /去绑定/ }).getAttribute('href')).toBe('/bind')
  })

  it('两步确认后调用解绑接口并触发全局心跳回绑定页', async () => {
    mockedStatus.mockResolvedValue({ status: 'valid', user: { uid: 98765, nickname: '风铃草' } })
    mockedUnbind.mockResolvedValue({ status: 'unbound' })
    render(Page)

    await waitFor(() => expect(screen.getByRole('button', { name: '重新绑定' })).toBeTruthy())
    await fireEvent.click(screen.getByRole('button', { name: '重新绑定' }))

    // 确认态出现：确认/取消双按钮
    const confirmButton = await screen.findByRole('button', { name: '确认解绑' })
    expect(screen.getByRole('button', { name: '取消' })).toBeTruthy()
    await fireEvent.click(confirmButton)

    await waitFor(() => expect(mockedUnbind).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockedCheck).toHaveBeenCalledTimes(1))
  })

  it('取消确认则不触发解绑', async () => {
    mockedStatus.mockResolvedValue({ status: 'valid', user: { uid: 98765, nickname: '风铃草' } })
    render(Page)

    await waitFor(() => expect(screen.getByRole('button', { name: '重新绑定' })).toBeTruthy())
    await fireEvent.click(screen.getByRole('button', { name: '重新绑定' }))
    await fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(mockedUnbind).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '重新绑定' })).toBeTruthy()
  })

  it('选择音质档位后偏好写入 localStorage', async () => {
    mockedStatus.mockResolvedValue({ status: 'unbound' })
    render(Page)

    await fireEvent.click(screen.getByRole('radio', { name: '无损' }))

    expect(get(currentSoundLevel)).toBe('lossless')
    expect(localStorage.getItem(SOUND_LEVEL_STORAGE_KEY)).toBe('lossless')
  })
})
