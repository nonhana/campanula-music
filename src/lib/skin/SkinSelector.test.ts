import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { SKIN_STORAGE_KEY } from './skins'
import SkinSelector from './SkinSelector.svelte'

afterEach(() => {
  cleanup()
  localStorage.clear()
  delete document.documentElement.dataset.skin
})

describe('skinSelector', () => {
  it('列出全部可用皮肤', () => {
    render(SkinSelector)
    expect(screen.getByRole('radio', { name: /风铃草/ })).toBeTruthy()
  })

  it('点击皮肤后 html 的 data-skin 即时切换', async () => {
    render(SkinSelector)
    await fireEvent.click(screen.getByRole('radio', { name: /风铃草/ }))
    expect(document.documentElement.dataset.skin).toBe('campanula')
  })

  it('点击皮肤后偏好写入 localStorage', async () => {
    render(SkinSelector)
    await fireEvent.click(screen.getByRole('radio', { name: /风铃草/ }))
    expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe('campanula')
  })
})
