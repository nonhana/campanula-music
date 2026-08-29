import type { SoundLevelOption } from './levels'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { get } from 'svelte/store'
import { afterEach, describe, expect, it } from 'vitest'
import { currentSoundLevel } from './currentSoundLevel'
import { DEFAULT_SOUND_LEVEL, SOUND_LEVEL_STORAGE_KEY, SOUND_LEVELS } from './levels'
import SoundLevelSelector from './SoundLevelSelector.svelte'

afterEach(() => {
  cleanup()
  localStorage.clear()
  currentSoundLevel.set(DEFAULT_SOUND_LEVEL)
})

describe('soundLevelSelector', () => {
  /** 选项的无障碍名 = 档位名 */
  function radioName(level: SoundLevelOption) {
    return level.label
  }

  it('列出全部可用音质档位', () => {
    render(SoundLevelSelector)
    for (const level of SOUND_LEVELS) {
      expect(screen.getByRole('radio', { name: radioName(level) })).toBeTruthy()
    }
  })

  it('点击档位后当前音质档位 store 即时切换', async () => {
    render(SoundLevelSelector)
    const lossless = SOUND_LEVELS.find(level => level.id === 'lossless')!
    await fireEvent.click(screen.getByRole('radio', { name: radioName(lossless) }))
    expect(get(currentSoundLevel)).toBe('lossless')
  })

  it('点击档位后偏好写入 localStorage', async () => {
    render(SoundLevelSelector)
    const hires = SOUND_LEVELS.find(level => level.id === 'hires')!
    await fireEvent.click(screen.getByRole('radio', { name: radioName(hires) }))
    expect(localStorage.getItem(SOUND_LEVEL_STORAGE_KEY)).toBe('hires')
  })

  it('当前档位对应的选项呈选中态', async () => {
    render(SoundLevelSelector)
    const standard = SOUND_LEVELS.find(level => level.id === 'standard')!
    const radio = screen.getByRole('radio', { name: radioName(standard) })
    expect(radio.getAttribute('aria-checked')).toBe('true')
  })
})
