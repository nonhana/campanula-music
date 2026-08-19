import { bindingInvalid, clearBindingInvalid } from '$lib/binding'
import { cleanup, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import Banner from './BindingInvalidBanner.svelte'

afterEach(() => {
  cleanup()
  clearBindingInvalid()
})

describe('绑定失效横幅', () => {
  it('未置位时不渲染', () => {
    render(Banner)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('置位后呈现常驻预警与「重新扫码绑定」入口', () => {
    bindingInvalid.set(true)
    render(Banner)

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('绑定已失效')
    const link = screen.getByRole('link', { name: '重新扫码绑定' })
    expect(link.getAttribute('href')).toBe('/bind')
  })
})
