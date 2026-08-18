import { currentSoundLevel } from '$lib/soundLevel/currentSoundLevel'
import { DEFAULT_SOUND_LEVEL, SOUND_LEVEL_STORAGE_KEY } from '$lib/soundLevel/levels'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { get } from 'svelte/store'
import { afterEach, describe, expect, it } from 'vitest'
import Page from './+page.svelte'

afterEach(() => {
  cleanup()
  localStorage.clear()
  currentSoundLevel.set(DEFAULT_SOUND_LEVEL)
})

describe('设置页', () => {
  it('同时呈现「皮肤」与「音质档位」两个偏好区块', () => {
    render(Page)

    expect(screen.getByRole('heading', { name: '设置' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '皮肤' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: '皮肤' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '音质档位' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: '音质档位' })).toBeTruthy()
  })

  it('选择音质档位后偏好写入 localStorage', async () => {
    render(Page)

    await fireEvent.click(screen.getByRole('radio', { name: /无损音质/ }))

    expect(get(currentSoundLevel)).toBe('lossless')
    expect(localStorage.getItem(SOUND_LEVEL_STORAGE_KEY)).toBe('lossless')
  })
})
