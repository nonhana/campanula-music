import { get } from 'svelte/store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentSoundLevel, initSoundLevel, readStoredSoundLevel, setSoundLevel } from './currentSoundLevel'
import { DEFAULT_SOUND_LEVEL, SOUND_LEVEL_STORAGE_KEY } from './levels'

function clearSoundLevelState() {
  localStorage.clear()
  currentSoundLevel.set(DEFAULT_SOUND_LEVEL)
}

afterEach(clearSoundLevelState)

describe('setSoundLevel', () => {
  it('同步当前音质档位 store', () => {
    setSoundLevel('lossless')
    expect(get(currentSoundLevel)).toBe('lossless')
  })

  it('把音质档位偏好持久化到 localStorage', () => {
    setSoundLevel('hires')
    expect(localStorage.getItem(SOUND_LEVEL_STORAGE_KEY)).toBe('hires')
  })
})

describe('readStoredSoundLevel', () => {
  it('返回合法的持久化音质档位', () => {
    localStorage.setItem(SOUND_LEVEL_STORAGE_KEY, 'exhigh')
    expect(readStoredSoundLevel()).toBe('exhigh')
  })

  it('持久化值为未知档位时返回 null', () => {
    localStorage.setItem(SOUND_LEVEL_STORAGE_KEY, 'ultra')
    expect(readStoredSoundLevel()).toBeNull()
  })

  it('无持久化值时返回 null', () => {
    expect(readStoredSoundLevel()).toBeNull()
  })
})

describe('initSoundLevel', () => {
  it('采用持久化的音质档位偏好', () => {
    localStorage.setItem(SOUND_LEVEL_STORAGE_KEY, 'higher')
    initSoundLevel()
    expect(get(currentSoundLevel)).toBe('higher')
  })

  it('无持久化偏好时保持默认档位', () => {
    initSoundLevel()
    expect(get(currentSoundLevel)).toBe(DEFAULT_SOUND_LEVEL)
  })

  it('持久化值为未知档位时保持默认档位', () => {
    localStorage.setItem(SOUND_LEVEL_STORAGE_KEY, 'ultra')
    initSoundLevel()
    expect(get(currentSoundLevel)).toBe(DEFAULT_SOUND_LEVEL)
  })

  it('存储抛异常（隐私模式）时保持默认档位', () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    initSoundLevel()
    expect(get(currentSoundLevel)).toBe(DEFAULT_SOUND_LEVEL)
    getItem.mockRestore()
  })

  it('持久化写入失败时切换仍即时生效', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    setSoundLevel('lossless')
    expect(get(currentSoundLevel)).toBe('lossless')
    setItem.mockRestore()
  })
})
