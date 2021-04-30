import { HTTPError } from '../errors.js'
import { parseMultipart } from '../utils/multipart/index.js'
import * as pinata from '../pinata.js'
import * as cluster from '../cluster.js'
import * as nfts from '../models/nfts.js'
import * as pins from '../models/pins.js'
import { JSONResponse } from '../utils/json-response.js'
import { validate } from '../utils/auth.js'

/**
 * @typedef {import('../bindings').NFT} NFT
 */

/**
 * @param {FetchEvent} event
 */
export async function upload(event) {
  const { headers } = event.request
  const contentType = headers.get('content-type') || ''
  const { user, tokenName } = await validate(event)

  if (contentType.includes('multipart/form-data')) {
    const boundary = contentType.split('boundary=')[1].trim()
    const parts = await parseMultipart(event.request.body, boundary)
    const dir = await cluster.addDirectory(parts)
    const { cid, size } = dir[dir.length - 1]
    event.waitUntil(
      (async () => {
        try {
          await pinata.pinByHash(cid, {
            pinataOptions: { hostNodes: cluster.delegates() },
            pinataMetadata: { name: `${user.nickname}-${Date.now()}` },
          })
        } catch (err) {
          console.error(err)
        }
      })()
    )
    const created = new Date()
    /** @type {NFT} */
    const nft = {
      cid,
      created: created.toISOString(),
      type: 'directory',
      scope: tokenName,
      files: parts.map((f) => ({
        name: f.filename || f.name,
        type: f.contentType,
      })),
    }
    let pin = await pins.get(cid)
    if (!pin || pin.status !== 'pinned') {
      // @ts-ignore
      pin = { status: 'pinned', size, created: created.toISOString() }
      await pins.set(cid, pin)
    }
    const result = await nfts.set({ user, cid }, nft)
    return new JSONResponse({
      ok: true,
      value: { ...result, size, pin, deals: [] },
    })
  } else {
    const blob = await event.request.blob()
    if (blob.size === 0) {
      return HTTPError.respond(new HTTPError('Empty payload', 400))
    }
    const { cid, size } = await cluster.add(blob)
    event.waitUntil(
      (async () => {
        try {
          await pinata.pinByHash(cid, {
            pinataOptions: { hostNodes: cluster.delegates() },
            pinataMetadata: { name: `${user.nickname}-${Date.now()}` },
          })
        } catch (err) {
          console.error(err)
        }
      })()
    )
    const created = new Date()
    /** @type {NFT} */
    const nft = {
      cid,
      created: created.toISOString(),
      type: blob.type,
      scope: tokenName,
      files: [],
    }
    let pin = await pins.get(cid)
    if (!pin || pin.status !== 'pinned') {
      pin = {
        status: 'pinned',
        size: blob.size,
        created: created.toISOString(),
      }
      await pins.set(cid, pin)
    }
    const result = await nfts.set({ user, cid }, nft)
    return new JSONResponse({
      ok: true,
      value: { ...result, size: blob.size, pin, deals: [] },
    })
  }
}
