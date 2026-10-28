import { describe, expect, it } from 'vitest'

import type { App } from '#lib/app/app.js'
import type { OperationNotice } from '#lib/app/notice.js'

import { useWorld } from './harness/world'

const world = useWorld()

/** 只是给断言起个名字：id 由 App 管，测试按行为看 */
const shown = (app: App): readonly OperationNotice[] => app.state.notices.map(entry => entry.notice)
const texts = (app: App): string[] => shown(app).map(notice => notice.kind === 'plain'
  ? notice.text
  : notice.kind)

// 提示条的一摞（#30、#33、#38，Spec #11“界面”）：做成了的 4 秒后自己走，出错的一直留着；最多 3 条；
// 同一个动作 2 秒内又来一条时合并到原来那一条。渲染和位置由 components/notice/NoticeStack.svelte 负责。
describe('提示条', () => {
  it('成功的一条 4 秒后自己走，出错的一直留着', async () => {
    const device = world.device()
    const { app } = await device.open()

    app.toast('success', '已复制')
    app.toast('error', '没能复制：剪贴板不让写')
    expect(app.state.notices).toMatchObject([
      {
        notice: { kind: 'plain', tone: 'success', text: '已复制' },
        tone: 'success',
        actions: ['dismiss'],
      },
      {
        notice: { kind: 'plain', tone: 'error', text: '没能复制：剪贴板不让写' },
        tone: 'error',
        actions: ['dismiss'],
      },
    ])

    await world.clock.advance(4000)
    expect(texts(app)).toEqual(['没能复制：剪贴板不让写'])

    await world.clock.advance(60_000)
    expect(texts(app)).toEqual(['没能复制：剪贴板不让写'])
  })

  it('最多 3 条：满时先走最旧的可自动消失的成功提示，没有就最旧一条', async () => {
    const device = world.device()
    const { app } = await device.open()

    app.toast('error', '出错一')
    app.toast('error', '出错二')
    app.toast('success', '做成了')
    expect(texts(app)).toEqual(['出错一', '出错二', '做成了'])

    app.toast('error', '出错三')
    expect(texts(app)).toEqual(['出错一', '出错二', '出错三'])

    app.toast('error', '出错四')
    expect(texts(app)).toEqual(['出错二', '出错三', '出错四'])

    app.toast('success', '又做成了')
    expect(texts(app)).toEqual(['出错三', '出错四', '又做成了'])
  })

  it('同一个动作 2 秒内又来一条：留在原来那一行、换掉内容，4 秒重新算；超过 2 秒另起一条', async () => {
    const device = world.device()
    const { app } = await device.open()

    const first = app.toast('success', '一', { key: 'copy' })
    await world.clock.advance(1500)
    const again = app.toast('success', '二', { key: 'copy' })
    expect(again).toBe(first)
    expect(texts(app)).toEqual(['二'])

    // 4 秒从后一条算：前一条的 4 秒到了也不走
    await world.clock.advance(3999)
    expect(texts(app)).toEqual(['二'])
    await world.clock.advance(1)
    expect(texts(app)).toEqual([])

    app.toast('success', '甲', { key: 'copy' })
    await world.clock.advance(2001)
    app.toast('success', '乙', { key: 'copy' })
    expect(texts(app)).toEqual(['甲', '乙'])
  })

  it('按 id 关掉的是那一条，别的还在', async () => {
    const device = world.device()
    const { app } = await device.open()

    const first = app.toast('error', '出错一')
    const second = app.toast('error', '出错二')
    expect(first).not.toBe(second)

    await app.noticeAction(first, 'dismiss')
    expect(texts(app)).toEqual(['出错二'])

    await app.noticeAction(second, 'dismiss')
    expect(texts(app)).toEqual([])
  })

  it('这一条不支持的动作什么都不做', async () => {
    const device = world.device()
    const { app } = await device.open()

    const plain = app.toast('error', '没能复制：剪贴板不让写')
    await app.noticeAction(plain, 'retry')
    await app.noticeAction(plain, 'undo')
    await app.noticeAction(plain, 'resume')
    expect(texts(app)).toEqual(['没能复制：剪贴板不让写'])
  })
})
