import type { LayerOptions } from '../src/lib/components/overlay/overlay-stack'
import { describe, expect, it } from 'vitest'
import { OverlayStack } from '../src/lib/components/overlay/overlay-stack'
import { MemoryOverlayHistory } from './harness/overlay-history'

describe('返回可收起的层', () => {
  it('菜单转交加入歌单再新建，返回直接收起，不回到旧菜单', async () => {
    const history = new MemoryOverlayHistory('/playlists/1')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const menu = stack.register<{ from: string }>('menu', {
      history: () => true,
      modal: true,
    })
    const picker = stack.register<{ from: string }>('picker', {
      history: () => true,
      modal: true,
    })
    const editor = stack.register<{ from: string }>('editor', {
      history: () => true,
      modal: true,
    })
    await menu.open({ from: 'more' })
    await menu.transfer(picker, { from: 'more' })
    await picker.transfer(editor, { from: 'more' })
    expect(stack.top?.name).toBe('editor')
    expect(history.length).toBe(2)
    await history.back()
    expect(stack.top).toBeNull()
    expect(history.url).toBe('/playlists/1')
    expect(history.index).toBe(0)
  })
  it('关播放页一次消费播放页和队列两条，焦点等下层解除 inert 后再归还', async () => {
    const history = new MemoryOverlayHistory('/downloads')
    const focused: string[] = []
    let painted = false
    const stack = new OverlayStack<string>(history, {
      changed() { painted = false },
      async rendered() { painted = true },
      focus(target) {
        expect(painted).toBe(true)
        focused.push(target!)
      },
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const player = stack.register<{ from: string }>('player', {
      history: () => true,
      modal: true,
    })
    const queue = stack.register<{ from: string }>('queue', {
      history: () => true,
      modal: true,
    })
    await player.open({ from: 'player-bar' })
    await queue.open({ from: 'queue-button' })
    expect(player.inert).toBe(true)
    await player.closeThrough()
    expect(history.index).toBe(0)
    expect(stack.top).toBeNull()
    expect(stack.baseInert).toBe(false)
    expect(focused).toEqual(['player-bar'])
  })

  it('入口被层换掉时用 focusReturn 找回来；返回 null 时退回 request.from，其他层不变', async () => {
    const history = new MemoryOverlayHistory('/playlists/1')
    const focused: (string | null)[] = []
    const fallbacks: (string | undefined)[] = []
    let painted = false
    const stack = new OverlayStack<string>(history, {
      changed() { painted = false },
      async rendered() { painted = true },
      focus(target, fallback) {
        expect(painted).toBe(true)
        focused.push(target)
        fallbacks.push(fallback)
      },
    }, 'session')
    history.listen(phase => stack.reconcile(phase))

    // 多选：打开它的按钮在层开着时被工具条换掉，关掉后重新找到新入口
    let entry = 'old-entry'
    const selection = stack.register<{ from: string | null }>('selection', {
      history: () => false,
      modal: false,
      focusReturn: () => entry,
    })
    await selection.open({ from: 'old-entry' })
    entry = 'new-entry'
    await selection.close()
    expect(focused).toEqual(['new-entry'])

    // focusReturn 返回 null：退回 request.from
    focused.length = 0
    let missing: string | null = null
    const withNull = stack.register<{ from: string | null }>('with-null', {
      history: () => false,
      modal: false,
      focusReturn: () => missing,
    })
    await withNull.open({ from: 'origin' })
    missing = null
    await withNull.close()
    expect(focused).toEqual(['origin'])

    // 没给 focusReturn：行为和其他层一样，用 request.from，fallback 原样交给适配器
    focused.length = 0
    fallbacks.length = 0
    const plain = stack.register<{ from: string | null }>('plain', {
      history: () => false,
      modal: false,
      fallback: '[data-entry]',
    })
    await plain.open({ from: 'plain-origin' })
    await plain.close()
    expect(focused).toEqual(['plain-origin'])
    expect(fallbacks).toEqual(['[data-entry]'])

    // focusReturn 和 request.from 都没有：把 null 交给适配器，由它兜底到 fallback 里的元素
    focused.length = 0
    fallbacks.length = 0
    const nothing = stack.register<{ from: string | null }>('nothing', {
      history: () => false,
      modal: false,
      focusReturn: () => null,
      fallback: '[data-entry]',
    })
    await nothing.open({ from: null })
    await nothing.close()
    expect(focused).toEqual([null])
    expect(fallbacks).toEqual(['[data-entry]'])
  })

  it('忙时 Esc 和返回都不关层，返回恢复原历史条目而不增压', async () => {
    const history = new MemoryOverlayHistory('/playlists')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const editor = stack.register<{ from: string }>('editor', {
      history: () => true,
      modal: true,
    })
    await editor.open({ from: 'new' })
    editor.setBusy(true)
    await stack.escape()
    await history.back()
    expect(editor.request).toEqual({ from: 'new' })
    expect(history.index).toBe(1)
    expect(history.length).toBe(2)
    editor.setBusy(false)
    await editor.close()
    expect(history.index).toBe(0)
    expect(stack.top).toBeNull()
  })

  it('编辑叠换封面后刷新、返回旧浅条，新会话清标记后重新开关不多退', async () => {
    const history = new MemoryOverlayHistory('/playlists/1')
    const effects = {
      changed() {},
      async rendered() {},
      focus() {},
    }
    const old = new OverlayStack<string>(history, effects, 'old')
    history.listen(phase => old.reconcile(phase))
    const editor = old.register<{ from: string }>('editor', {
      history: () => true,
      modal: true,
    })
    const cover = old.register<{ from: string }>('cover', {
      history: () => true,
      modal: true,
    })
    await editor.open({ from: 'more' })
    await cover.open({ from: 'cover-button' })
    history.reload()
    const stack = new OverlayStack<string>(history, effects, 'new')
    history.listen(phase => stack.reconcile(phase))
    await history.back()
    expect(history.read().marker).toBeUndefined()
    const reopened = stack.register<{ from: string }>('editor', {
      history: () => true,
      modal: true,
    })
    await reopened.open({ from: 'more' })
    expect(history.index).toBe(2)
    await reopened.close()
    expect(history.index).toBe(1)
    expect(stack.top).toBeNull()
  })

  it('esc 只关最上层；下层按钮不能越过它，桌面层不压历史', async () => {
    const history = new MemoryOverlayHistory('/playlists')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const editor = stack.register<{ from: string }>('editor', {
      history: () => false,
      modal: true,
    })
    const cover = stack.register<{ from: string }>('cover', {
      history: () => false,
      modal: true,
    })
    await editor.open({ from: 'new' })
    await cover.open({ from: 'cover' })
    await editor.close()
    expect(stack.top?.name).toBe('cover')
    await stack.escape()
    expect(stack.top?.name).toBe('editor')
    expect(editor.inert).toBe(false)
    expect(history.length).toBe(1)
  })

  it('删除或退出先消费所有层再替换底页，返回不会回到删除页', async () => {
    const history = new MemoryOverlayHistory('/playlists/1')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const selection = stack.register<{ from: string }>('selection', {
      history: () => true,
      modal: false,
    })
    const confirm = stack.register<{ from: string }>('confirm', {
      history: () => true,
      modal: true,
    })
    await selection.open({ from: 'select' })
    await confirm.open({ from: 'delete' })
    await confirm.leaveTo('/playlists')
    expect(stack.top).toBeNull()
    expect(history.index).toBe(0)
    expect(history.url).toBe('/playlists')
    await history.back()
    expect(history.url).toBe('/playlists')
  })

  it('触屏菜单转交桌面弹窗，消费原浅条而不压桌面历史', async () => {
    const history = new MemoryOverlayHistory('/playlists')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const menu = stack.register<{ from: string }>('menu', {
      history: () => true,
      modal: true,
    })
    const editor = stack.register<{ from: string }>('editor', {
      history: () => false,
      modal: true,
    })
    await menu.open({ from: 'more' })
    await menu.transfer(editor, { from: 'more' })
    expect(history.index).toBe(0)
    expect(stack.top?.name).toBe('editor')
    await editor.close()
    expect(history.index).toBe(0)
    expect(stack.baseInert).toBe(false)
  })

  it('上传中返回先取消上传但保留裁剪层和原历史，下一次才关闭', async () => {
    const history = new MemoryOverlayHistory('/playlists/1')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    let uploading = true
    let cancelled = 0
    const cover = stack.register<{ from: string }>('cover', {
      history: () => true,
      modal: true,
      beforeClose() {
        if (!uploading)
          return true
        uploading = false
        cancelled += 1
        return false
      },
    })
    await cover.open({ from: 'cover-button' })
    await history.back()
    expect(cancelled).toBe(1)
    expect(stack.top?.name).toBe('cover')
    expect(history.index).toBe(1)
    await history.back()
    expect(stack.top).toBeNull()
    expect(history.index).toBe(0)
  })

  it('浅路由失败不留下空层、inert 或错误地消费历史，重试仍能打开', async () => {
    const history = new MemoryOverlayHistory('/playlists')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const editor = stack.register<{ from: string }>('editor', {
      history: () => true,
      modal: true,
    })
    history.failNext('write', 'beforeCommit')
    await expect(editor.open({ from: 'new' })).rejects.toThrow()
    expect(stack.top).toBeNull()
    expect(stack.baseInert).toBe(false)
    expect(history.index).toBe(0)
    await editor.open({ from: 'new' })
    await editor.close()
    expect(history.index).toBe(0)
  })

  it('离开被拒绝时恢复原层的历史，仍可关闭或重试', async () => {
    const history = new MemoryOverlayHistory('/playlists/1')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const editor = stack.register<{ from: string }>('editor', {
      history: () => true,
      modal: true,
    })
    await editor.open({ from: 'delete' })
    history.failNext('leave', 'beforeCommit')
    await expect(editor.leaveTo('/playlists')).rejects.toThrow()
    expect(history.index).toBe(1)
    expect(stack.top?.name).toBe('editor')
    await editor.close()
    expect(history.index).toBe(0)
  })

  it('会话清空时尚未完成的打开不会把旧层和 inert 放回来', async () => {
    const history = new MemoryOverlayHistory('/playlists')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const editor = stack.register<{ from: string }>('editor', {
      history: () => true,
      modal: true,
    })
    const held = history.holdNext('write', 'afterCommit')
    const opening = editor.open({ from: 'new' })
    await held.reached
    stack.clear()
    held.release()
    await opening
    expect(stack.top).toBeNull()
    expect(stack.baseInert).toBe(false)
    expect(editor.request).toBeNull()
  })

  it('同会话的播放页和队列按原条目前进恢复，不再压历史', async () => {
    const history = new MemoryOverlayHistory('/downloads')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const player = stack.register<{ from: string }>('player', {
      history: () => true,
      modal: true,
      restore: () => true,
    })
    const queue = stack.register<{ from: string }>('queue', {
      history: () => true,
      modal: true,
      restore: () => true,
      dependsOn: 'player',
    })
    await player.open({ from: 'bar' })
    await queue.open({ from: 'queue-button' })
    await player.closeThrough()
    await history.forward()
    expect(player.request).toEqual({ from: 'bar' })
    expect(queue.request).toBeNull()
    await history.forward()
    expect(queue.request).toEqual({ from: 'queue-button' })
    expect(history.length).toBe(3)
  })

  it('来源歌曲变空不销毁独立忙碌新建，关闭时一并消费多选空槽', async () => {
    const history = new MemoryOverlayHistory('/playlists/1')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const selection = stack.register<{ from: string }>('selection', {
      history: () => true,
      modal: false,
    })
    const editor = stack.register<{ from: string }>('editor', {
      history: () => true,
      modal: true,
    })
    await selection.open({ from: 'select' })
    await editor.open({ from: 'batch' })
    editor.setBusy(true)
    await selection.invalidate()
    expect(editor.request).toEqual({ from: 'batch' })
    expect(editor.busy).toBe(true)
    editor.setBusy(false)
    await editor.close()
    expect(history.index).toBe(0)
  })

  it('已排队但会话失效的离开明确返回 invalidated，不能放行后续业务', async () => {
    const history = new MemoryOverlayHistory('/settings')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const confirm = stack.register<{ from: string }>('confirm', {
      history: () => true,
      modal: true,
    })
    await confirm.open({ from: 'logout' })
    const leaving = confirm.leaveTo('/')
    stack.clear()
    expect(await leaving).toBe('invalidated')
    expect(history.url).toBe('/settings')
  })
})

describe('审查反例的历史与来源失效', () => {
  function scene() {
    const history = new MemoryOverlayHistory('/playlists/1')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase), () => stack.navigate())
    const register = (name: string, options: Partial<LayerOptions<{ from: string }>> = {}) => stack.register<{ from: string }>(name, {
      history: () => true,
      modal: true,
      ...options,
    })
    return { history, stack, register }
  }

  it('goto 被取消但正常 resolve 时不提交层', async () => {
    const { history, stack, register } = scene()
    const editor = register('editor')
    history.cancelNext('write')
    expect(await editor.open({ from: 'new' })).toBe('cancelled')
    expect(editor.request).toBeNull()
    expect(stack.baseInert).toBe(false)
    expect(history.length).toBe(1)
  })

  it('浅写已压入后失败只恢复自己的条目，重试不累积空槽', async () => {
    const { history, stack, register } = scene()
    const editor = register('editor')
    history.failNext('write', 'afterCommit')
    await expect(editor.open({ from: 'new' })).rejects.toThrow('afterCommit')
    expect(history.index).toBe(0)
    expect(stack.top).toBeNull()
    await editor.open({ from: 'new' })
    expect(history.length).toBe(2)
    await editor.close()
    expect(history.index).toBe(0)
  })

  it('浅写已经压入但等待回调时返回，不丢外部返回或提交旧层', async () => {
    const { history, stack, register } = scene()
    const held = history.holdNext('write', 'afterCommit')
    const opening = register('editor').open({ from: 'new' })
    await held.reached
    expect(history.index).toBe(1)
    const back = history.back()
    await Promise.resolve()
    held.release()
    expect(await opening).toBe('invalidated')
    await back
    expect(stack.top).toBeNull()
    expect(history.index).toBe(0)
  })

  it.each(['beforeCommit', 'afterCommit'] as const)('leaveTo 在 %s 被外部导航取代，不前进回旧页、不放行业务', async (phase) => {
    const { history, stack, register } = scene()
    const confirm = register('confirm')
    await confirm.open({ from: 'delete' })
    const held = history.holdNext('leave', phase)
    let businessWrites = 0
    const leaving = confirm.leaveTo('/').then((result) => {
      if (result === 'committed')
        businessWrites += 1
      return result
    })
    await held.reached
    const navigation = history.navigate('/downloads')
    await Promise.resolve()
    held.release()
    expect(await leaving).toBe('invalidated')
    await navigation
    expect(history.url).toBe('/downloads')
    expect(businessWrites).toBe(0)
    expect(stack.top).toBeNull()
  })

  it('忙层返回恢复途中又返回，第二次不能冒充第一次的目标完成', async () => {
    const { history, stack, register } = scene()
    const editor = register('editor')
    await editor.open({ from: 'new' })
    editor.setBusy(true)
    const held = history.holdNext('go', 'afterCommit')
    const first = history.back()
    await held.reached
    const second = history.back()
    await Promise.resolve()
    held.release()
    await Promise.all([first, second])
    expect(history.index).toBe(1)
    expect(editor.busy).toBe(true)
    expect(stack.top?.name).toBe('editor')
    expect(history.length).toBe(2)
  })

  it('父编辑来源失效不能强杀 set；失败允许关闭后不留下空父层', async () => {
    const { history, stack, register } = scene()
    const editor = register('editor')
    let setting = true
    let closeIntents = 0
    const cover = register('cover', {
      dependsOn: 'editor',
      beforeClose: () => {
        closeIntents += 1
        return !setting
      },
    })
    await editor.open({ from: 'more' })
    await cover.open({ from: 'cover-button' })
    await editor.invalidate()
    expect(closeIntents).toBe(1)
    expect(cover.request).not.toBeNull()
    expect(editor.request).toBeNull()
    setting = false
    await cover.invalidate()
    expect(closeIntents).toBe(2)
    expect(stack.baseInert).toBe(false)
    expect(history.index).toBe(0)
  })

  it('依赖多选的 picker 随来源失效，未完成的退出不能继续批量加入', async () => {
    const { history, stack, register } = scene()
    const selection = register('selection', { modal: false })
    const picker = register('picker', { dependsOn: 'selection' })
    await selection.open({ from: 'select' })
    await picker.open({ from: 'batch' })
    await selection.invalidate()
    expect(picker.request).toBeNull()
    expect(await selection.closeThrough()).toBe('cancelled')
    expect(stack.top).toBeNull()
    expect(history.index).toBe(0)
  })

  it('同一层按请求依赖来源：单曲那条不要求多选开着，多选那条随多选失效', async () => {
    const history = new MemoryOverlayHistory('/playlists/1')
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'session')
    history.listen(phase => stack.reconcile(phase))
    const selection = stack.register<{ from: string }>('selection', {
      history: () => false,
      modal: false,
    })
    const picker = stack.register<{ from: string, mode: 'song' | 'multi' }>('picker', {
      history: () => false,
      modal: false,
      dependsOn: request => request.mode === 'multi'
        ? 'selection'
        : null,
    })

    // 歌曲菜单转交来的单曲选择器：多选没开也能打开
    expect(await picker.open({ from: 'more', mode: 'song' })).toBe('committed')
    expect(picker.request).toEqual({ from: 'more', mode: 'song' })
    await picker.close()

    // 多选打开的选择器：来源没开时打不开；开着才打开，来源失效就跟着没
    expect(await picker.open({ from: 'select', mode: 'multi' })).toBe('cancelled')
    await selection.open({ from: 'select' })
    expect(await picker.open({ from: 'select', mode: 'multi' })).toBe('committed')
    await selection.invalidate()
    expect(picker.request).toBeNull()
    expect(stack.top).toBeNull()
    expect(history.index).toBe(0)
  })

  it('来源变空保留独立播放页，其后关闭消费多选留下的物理槽', async () => {
    const { history, register } = scene()
    const selection = register('selection', { modal: false })
    const player = register('player', {
      restore: () => true,
    })
    await selection.open({ from: 'select' })
    await player.open({ from: 'bar' })
    await selection.invalidate()
    expect(player.request).toEqual({ from: 'bar' })
    await player.close()
    expect(history.index).toBe(0)
  })

  it('播放队列清空后前进不能恢复无内容的 inert 层', async () => {
    const { history, stack, register } = scene()
    let playable = true
    const player = register('player', {
      restore: () => playable,
    })
    await player.open({ from: 'bar' })
    await history.back()
    playable = false
    await history.forward()
    expect(player.request).toBeNull()
    expect(stack.baseInert).toBe(false)
  })

  it('前进只恢复播放层，不复活已经结束的菜单', async () => {
    const { history, stack, register } = scene()
    const player = register('player', {
      restore: () => true,
    })
    const menu = register('menu')
    await player.open({ from: 'bar' })
    await menu.open({ from: 'more' })
    await history.back()
    await history.back()
    await history.forward()
    await history.forward()
    expect(player.request).not.toBeNull()
    expect(menu.request).toBeNull()
    expect(stack.top?.name).toBe('player')
  })

  it('目标替换提交后失败恢复弹窗后，下一次忙时返回仍钉在原条目', async () => {
    const { history, register } = scene()
    const editor = register('editor')
    await editor.open({ from: 'delete' })
    history.failNext('leave', 'afterCommit')
    await expect(editor.leaveTo('/')).rejects.toThrow('afterCommit')
    editor.setBusy(true)
    await history.back()
    expect(history.index).toBe(1)
    expect(editor.request).toEqual({ from: 'delete' })
  })

  it('来源失效的替换失败不销毁独立 busy 请求，可再次失效并正确关闭', async () => {
    const { history, register } = scene()
    const selection = register('selection', { modal: false })
    const editor = register('editor')
    await selection.open({ from: 'select' })
    await editor.open({ from: 'batch' })
    editor.setBusy(true)
    history.failNext('write', 'afterCommit')
    await expect(selection.invalidate()).rejects.toThrow('afterCommit')
    expect(selection.request).not.toBeNull()
    expect(editor.request).toEqual({ from: 'batch' })
    expect(editor.busy).toBe(true)
    await selection.invalidate()
    editor.setBusy(false)
    await editor.close()
    expect(history.index).toBe(0)
  })

  it('原生返回已移动而 page.state 未更新时，不可在旧位置继续打开层', async () => {
    const { history, stack, register } = scene()
    await register('player', {
      restore: () => true,
    }).open({ from: 'bar' })
    const editor = register('editor')
    const held = history.holdNext('traverse', 'afterCommit')
    const back = history.back()
    await held.reached
    expect(await editor.open({ from: 'new' })).toBe('invalidated')
    held.release()
    await back
    expect(editor.request).toBeNull()
    expect(stack.top).toBeNull()
    expect(history.index).toBe(0)
  })

  it('已关闭确认层的旧离开动作不能导航或放行业务', async () => {
    const { history, register } = scene()
    const confirm = register('confirm')
    await confirm.open({ from: 'logout' })
    await confirm.close()
    expect(await confirm.leaveTo('/')).toBe('cancelled')
    expect(history.url).toBe('/playlists/1')
  })

  it('排队的旧关闭只属于原请求，不能关掉后来重开的同一种层', async () => {
    const { history, register } = scene()
    const editor = register('editor')
    await editor.open({ from: 'first' })
    const held = history.holdNext('go', 'beforeCommit')
    const firstClose = editor.close()
    await held.reached
    const reopening = editor.open({ from: 'second' })
    const oldClose = editor.close()
    held.release()
    await firstClose
    await reopening
    expect(await oldClose).toBe('invalidated')
    expect(editor.request).toEqual({ from: 'second' })
  })

  it('换到别的页面再回来，连续前进按原条目恢复播放页与队列，关队列仍退回播放页', async () => {
    const { history, stack, register } = scene()
    const player = register('player', {
      restore: () => true,
    })
    const queue = register('queue', {
      restore: () => true,
      dependsOn: 'player',
    })
    await history.navigate('/playlists/2')
    await player.open({ from: 'bar' })
    await queue.open({ from: 'queue-button' })
    await player.closeThrough()
    await history.back()
    expect(stack.top).toBeNull()
    await history.forward()
    await history.forward()
    expect(stack.top?.name).toBe('player')
    await history.forward()
    expect(stack.top?.name).toBe('queue')
    expect(player.request).toEqual({ from: 'bar' })
    expect(queue.request).toEqual({ from: 'queue-button' })
    expect(await queue.close()).toBe('committed')
    expect(history.index).toBe(2)
    expect(player.request).toEqual({ from: 'bar' })
    expect(await player.close()).toBe('committed')
    expect(history.index).toBe(1)
    expect(stack.top).toBeNull()
  })

  it('换页后前进不恢复空队列的播放层', async () => {
    const { history, stack, register } = scene()
    let playable = true
    const player = register('player', {
      restore: () => playable,
    })
    await history.navigate('/playlists/2')
    await player.open({ from: 'bar' })
    await history.back()
    playable = false
    await history.forward()
    expect(player.request).toBeNull()
    expect(stack.top).toBeNull()
    expect(stack.baseInert).toBe(false)
  })

  it('换页后前进不复活转交过的菜单', async () => {
    const { history, stack, register } = scene()
    const menu = register('menu')
    const picker = register('picker')
    await history.navigate('/playlists/2')
    await menu.open({ from: 'more' })
    await menu.transfer(picker, { from: 'more' })
    await history.navigate('/playlists/3')
    expect(stack.top).toBeNull()
    await history.back()
    expect(stack.top).toBeNull()
    await history.back()
    await history.forward()
    expect(stack.top).toBeNull()
    expect(menu.request).toBeNull()
    expect(picker.request).toBeNull()
  })

  it('刷新后的新会话不认旧条目上的恢复标记', async () => {
    const { history, register } = scene()
    const player = register('player', {
      restore: () => true,
    })
    await history.navigate('/playlists/2')
    await player.open({ from: 'bar' })
    await history.back()
    history.reload()
    const stack = new OverlayStack<string>(history, {
      changed() {},
      async rendered() {},
      focus() {},
    }, 'new-session')
    history.listen(phase => stack.reconcile(phase), () => stack.navigate())
    await history.forward()
    expect(stack.top).toBeNull()
    expect(stack.baseInert).toBe(false)
  })
})
