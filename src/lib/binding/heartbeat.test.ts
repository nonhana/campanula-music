import { goto } from '$app/navigation'
import { fetchBindingStatus } from '$lib/ncm/binding'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindingInvalid, clearBindingInvalid } from './bindingStore'
import { runBindingCheck } from './heartbeat'

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}))

vi.mock('$lib/ncm/binding', async (importOriginal) => {
  const mod = await importOriginal<typeof import('$lib/ncm/binding')>()
  return { ...mod, fetchBindingStatus: vi.fn() }
})

const mockedGoto = vi.mocked(goto)
const mockedFetch = vi.mocked(fetchBindingStatus)

beforeEach(() => {
  mockedGoto.mockReset()
  mockedFetch.mockReset()
  clearBindingInvalid()
})

afterEach(() => {
  clearBindingInvalid()
})

describe('runBindingCheck（心跳编排）', () => {
  it('尚未绑定 → 清提示并进入全屏绑定页', async () => {
    bindingInvalid.set(true)
    mockedFetch.mockResolvedValue({ status: 'unbound' })

    await runBindingCheck()

    expect(mockedGoto).toHaveBeenCalledWith('/bind')
    expect(get(bindingInvalid)).toBe(false)
  })

  it('绑定失效 → 置位全局失效提示，不跳转', async () => {
    mockedFetch.mockResolvedValue({ status: 'invalid' })

    await runBindingCheck()

    expect(mockedGoto).not.toHaveBeenCalled()
    expect(get(bindingInvalid)).toBe(true)
  })

  it('绑定有效 → 清除失效提示', async () => {
    bindingInvalid.set(true)
    mockedFetch.mockResolvedValue({ status: 'valid', user: { uid: 1, nickname: '风铃草' } })

    await runBindingCheck()

    expect(mockedGoto).not.toHaveBeenCalled()
    expect(get(bindingInvalid)).toBe(false)
  })

  it('状态拉取瞬时失败 → 静默跳过（不误踢用户）', async () => {
    bindingInvalid.set(true)
    mockedFetch.mockRejectedValue(new Error('network down'))

    await runBindingCheck()

    expect(mockedGoto).not.toHaveBeenCalled()
    expect(get(bindingInvalid)).toBe(true)
  })
})
