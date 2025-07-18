import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'

export function aesEncrypt(text: string, key: string): string {
  const keyBuffer = Buffer.from(key, 'utf8').subarray(0, 16)
  const paddedKey = Buffer.alloc(16)
  keyBuffer.copy(paddedKey)
  const cipher = crypto.createCipheriv('aes-128-ecb', paddedKey, null)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted.toUpperCase()
}

export function md5(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex')
}

export function eapiEncrypt(url: string, data: any): { params: string } {
  const eapiKey = 'e82ckenh8dichen8'
  const text = typeof data === 'object' ? JSON.stringify(data) : data
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = md5(message)
  const encryptText = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  return {
    params: aesEncrypt(encryptText, eapiKey),
  }
}
