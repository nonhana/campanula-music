import { addMessage } from '$lib/stores/messageStore'
import { writable } from 'svelte/store'

/**
 * 绑定失效的全局状态与提示。
 *
 * bindingInvalid 驱动应用壳内常驻失效横幅（含「重新扫码绑定」入口）；
 * 置位时首次同步弹出一条全局提示（后续重复置位去重，避免并发请求提示轰炸），
 * 重新绑定成功或心跳确认有效后清除并重新武装。
 * 本模块不依赖任何 ncm 数据模块，供传输层（client.ts）与心跳编排双向引用而无环。
 */

/** 绑定失效全局标记：true 时应用壳呈现常驻横幅 */
export const bindingInvalid = writable(false)

/** 全局提示文案：未绑定与失效两态共用（传输层无法区分，绑定页按状态呈现对应引导） */
const BINDING_INVALID_MESSAGE = '网易云账号未绑定或绑定已失效，请重新扫码绑定'

/** 是否已为当前失效期弹过全局提示 */
let invalidAnnounced = false

/** 标记绑定失效：置位横幅并（首次）弹出全局提示 */
export function markBindingInvalid(): void {
  bindingInvalid.set(true)
  if (invalidAnnounced)
    return
  invalidAnnounced = true
  addMessage({ type: 'error', message: BINDING_INVALID_MESSAGE, timeout: 8000 })
}

/** 清除绑定失效标记并重新武装提示（绑定成功或心跳确认有效时调用） */
export function clearBindingInvalid(): void {
  bindingInvalid.set(false)
  invalidAnnounced = false
}
