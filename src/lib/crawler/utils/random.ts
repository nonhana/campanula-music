export function generateRandomString(length: number, chars = 'abcdefghijklmnopqrstuvwxyz'): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function generateWNMCID(): string {
  const randomString = generateRandomString(6)
  return `${randomString}.${Date.now().toString()}.01.0`
}

export function generateNuid(): string {
  return generateRandomString(32, 'abcdefghijklmnopqrstuvwxyz0123456789')
}

export function generateNMTID(): string {
  return generateRandomString(16, 'abcdefghijklmnopqrstuvwxyz0123456789')
}
