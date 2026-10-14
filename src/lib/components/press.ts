// 按住拖动（播放页抽屉、进度滑块、自绘滚动条的滑块）时，松开的那一下可能根本传不到页面上：拖着时点了右键（弹出的菜单吞掉了松开）、
// 切走了窗口、页面被藏起来、浏览器收回了指针捕获。这时候拖动要马上作废，不然光标一直是抓着的手、抽屉卡在半路、页面点不动

/** 按住结束后还挡多久右键菜单：拖着时按下右键，浏览器先报按住断了，菜单随后才来（Windows 上要等右键松开） */
const MENU_GRACE_MS = 300

/** 拖动中移动时的 buttons（PointerEvent.buttons）说明按住已经断了：主键（鼠标左键、手指、笔尖）没按着了，或者又按下了右键 */
export function pressBroken(buttons: number): boolean {
  return (buttons & 1) === 0 || (buttons & 2) !== 0
}

/**
 * 按下后开始盯着：要弹出右键菜单（不让它弹）、窗口失去焦点、页面藏起来时调用 abandon。
 * 返回停止盯着的函数，拖动结束、作废时都要调用；停止后再挡 300ms 右键菜单，然后才放开
 */
export function watchPress(abandon: () => void): () => void {
  let ended = false
  const oncontextmenu = (event: Event) => {
    event.preventDefault()
    if (!ended)
      abandon()
  }
  const onvisibilitychange = () => {
    if (document.visibilityState === 'hidden')
      abandon()
  }
  window.addEventListener('contextmenu', oncontextmenu, true)
  window.addEventListener('blur', abandon)
  document.addEventListener('visibilitychange', onvisibilitychange)
  return () => {
    ended = true
    window.removeEventListener('blur', abandon)
    document.removeEventListener('visibilitychange', onvisibilitychange)
    setTimeout(() => window.removeEventListener('contextmenu', oncontextmenu, true), MENU_GRACE_MS)
  }
}
