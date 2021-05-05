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

  /** @type {NFT} */
  let nft
  let nftSize = 0
  const created = new Date().toISOString()

  if (contentType.includes('multipart/form-data')) {
    const boundary = contentType.split('boundary=')[1].trim()
    const parts = await parseMultipart(event.request.body, boundary)
    const dir = await cluster.addDirectory(parts)
    const { cid, size } = dir[dir.length - 1]
    nft = {
      cid,
      created,
      type: 'directory',
      scope: tokenName,
      files: parts.map((f) => ({
        name: f.filename || f.name,
        type: f.contentType,
      })),
    }
    // @ts-ignore
    nftSize = size
  } else {
    const blob = await event.request.blob()
    if (blob.size === 0) {
      throw new HTTPError('Empty payload', 400)
    }
    const { cid, size } = await cluster.add(blob)
    nft = {
      cid,
      created,
      type: blob.type,
      scope: tokenName,
      files: [],
    }
    // @ts-ignore
    nftSize = size
  }

  let pin = await pins.get(nft.cid)
  if (!pin || pin.status !== 'pinned') {
    pin = { status: 'pinned', size: nftSize, created }
    await pins.set(nft.cid, pin)
  }

  await nfts.set({ user, cid: nft.cid }, nft, pin)

  /** @type {import('../bindings').NFTResponse} */
  const res = {
    ...nft,
    size: pin.size,
    pin: { cid: nft.cid, ...pin },
    deals: [],
  }

  event.waitUntil(
    (async () => {
      try {
        await pinata.pinByHash(nft.cid, {
          pinataOptions: { hostNodes: cluster.delegates() },
          pinataMetadata: { name: `${user.nickname}-${Date.now()}` },
        })
      } catch (err) {
        console.error(err)
      }
    })()
  )

  return new JSONResponse({ ok: true, value: res })
}
