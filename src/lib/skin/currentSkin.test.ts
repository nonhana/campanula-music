import { get } from 'svelte/store'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentSkin, initSkin, readStoredSkin, setSkin } from './currentSkin'
import { DEFAULT_SKIN_ID, SKIN_STORAGE_KEY } from './skins'

function clearSkinState() {
  localStorage.clear()
  delete document.documentElement.dataset.skin
  currentSkin.set(DEFAULT_SKIN_ID)
}

afterEach(clearSkinState)

describe('setSkin', () => {
  it('把皮肤 id 写到 html 的 data-skin 属性', () => {
    setSkin('campanula')
    expect(document.documentElement.dataset.skin).toBe('campanula')
  })

  it('把皮肤偏好持久化到 localStorage', () => {
    setSkin('campanula')
    expect(localStorage.getItem(SKIN_STORAGE_KEY)).toBe('campanula')
  })

  it('同步当前皮肤 store', () => {
    setSkin('campanula')
    expect(get(currentSkin)).toBe('campanula')
  })
})

describe('readStoredSkin', () => {
  it('返回合法的持久化皮肤 id', () => {
    localStorage.setItem(SKIN_STORAGE_KEY, 'campanula')
    expect(readStoredSkin()).toBe('campanula')
  })

  it('持久化值为未知皮肤时返回 null', () => {
    localStorage.setItem(SKIN_STORAGE_KEY, 'mystery-skin')
    expect(readStoredSkin()).toBeNull()
  })

  it('无持久化值时返回 null', () => {
    expect(readStoredSkin()).toBeNull()
  })
})

describe('initSkin', () => {
  it('采用持久化的皮肤偏好', () => {
    localStorage.setItem(SKIN_STORAGE_KEY, 'campanula')
    initSkin()
    expect(document.documentElement.dataset.skin).toBe('campanula')
  })

  it('无持久化偏好时落到默认皮肤', () => {
    initSkin()
    expect(document.documentElement.dataset.skin).toBe(DEFAULT_SKIN_ID)
  })

  it('持久化值为未知皮肤时回落到默认皮肤', () => {
    localStorage.setItem(SKIN_STORAGE_KEY, 'mystery-skin')
    initSkin()
    expect(document.documentElement.dataset.skin).toBe(DEFAULT_SKIN_ID)
  })

  it('存储抛异常（隐私模式）时回落到默认皮肤', () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    initSkin()
    expect(document.documentElement.dataset.skin).toBe(DEFAULT_SKIN_ID)
    getItem.mockRestore()
  })

  it('持久化写入失败时切换仍即时生效', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    setSkin('campanula')
    expect(document.documentElement.dataset.skin).toBe('campanula')
    setItem.mockRestore()
  })
})
