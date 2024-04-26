import { atom, useAtom, useAtomValue } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { useLocation } from 'react-router-dom'

import { isClashX, jsBridge } from '@lib/jsBridge'
import { Client } from '@lib/request'

const clashxConfigAtom = atom(async () => {
    if (!isClashX()) {
        return null
    }

    const info = await jsBridge!.getAPIInfo()
    return {
        hostname: info.host,
        port: info.port,
        secret: info.secret,
        protocol: 'http:',
    }
})

// jotai v2 use initialValue first avoid hydration warning, but we don't want that
const hostsStorageOrigin = localStorage.getItem('externalControllers') ?? '[]'
const hostSelectIdxStorageOrigin = localStorage.getItem('externalControllerIndex') ?? '0'

export const hostsStorageAtom = atomWithStorage<Array<{
    hostname: string
    port: string
    secret: string
}>>('externalControllers', JSON.parse(hostsStorageOrigin))
export const hostSelectIdxStorageAtom = atomWithStorage<number>('externalControllerIndex', parseInt(hostSelectIdxStorageOrigin))

export function useAPIInfo () {
    const clashx = useAtomValue(clashxConfigAtom)
    const location = useLocation()
    const hostSelectIdxStorage = useAtomValue(hostSelectIdxStorageAtom)
    const hostsStorage = useAtomValue(hostsStorageAtom)

    if (clashx != null) {
        return clashx
    }

    let url: URL | undefined
    {
        const meta = document.querySelector<HTMLMetaElement>('meta[name="external-controller"]')
        if ((meta?.content?.match(/^https?:/)) != null) {
            // [protocol]://[secret]@[hostname]:[port]
            url = new URL(meta.content)
        }
    }

    const qs = new URLSearchParams(location.search)

    const hostname = qs.get('host') ?? hostsStorage?.[hostSelectIdxStorage]?.hostname ?? window.location.hostname ?? '127.0.0.1'
    const port = qs.get('port') ?? hostsStorage?.[hostSelectIdxStorage]?.port ?? window.location.port ?? '9090'
    const protocol = qs.get('protocol') ?? hostname === '127.0.0.1' ? 'http:' : window.location.protocol

    const secret = qs.get('secret') ?? hostsStorage?.[hostSelectIdxStorage]?.secret ?? url?.username ?? ''

    return { hostname, port, secret, protocol }
}

const clientAtom = atom({
    key: '',
    instance: null as Client | null,
})

export function useClient () {
    const {
        hostname,
        port,
        secret,
        protocol,
    } = useAPIInfo()

    const [item, setItem] = useAtom(clientAtom)
    const key = `${protocol}//${hostname}:${port}?secret=${secret}`
    if (item.key === key) {
        return item.instance!
    }

    const client = new Client(`${protocol}//${hostname}:${port}`, secret)
    setItem({ key, instance: client })

    return client
}
