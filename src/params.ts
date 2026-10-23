import { defineParams } from '@sveltejs/kit/params'

export const params = defineParams({
  neteaseId: (param) => {
    if (!/^[1-9]\d*$/.test(param))
      return
    const id = Number(param)
    if (Number.isSafeInteger(id) && String(id) === param)
      return id
  },
})
