import dbg from 'debug'
import { existsSync } from 'fs-extra'
import pMap from 'p-map'
import { isMainThread, parentPort, workerData } from 'worker_threads'
import { addMinutes, download, formatDateToPath, optimizeFilters, sequence, sha256, wait } from './handy'
import { Exchange, Filter } from './types'

const debug = dbg('tardis-dev')

if (isMainThread) {
  debug('existing, worker is not meant to run in main thread')
} else {
  getDataFeedSlices(workerData as WorkerJobPayload)
}

process.on('unhandledRejection', (err, promise) => {
  debug('Unhandled Rejection at: %o, reason: %o', promise, err)
  throw err
})

async function getDataFeedSlices(payload: WorkerJobPayload) {
  const MILLISECONDS_IN_MINUTE = 60 * 1000
  const CONCURRENCY_LIMIT = 60
  // deduplicate filters (if the channel was provided multiple times)
  const filters = optimizeFilters(payload.filters)

  // let's calculate number of minutes between "from" and "to" dates as those will give us total number of requests or checks
  // that will have to be performed concurrently with CONCURRENCY_LIMIT
  const minutesCountToFetch = Math.floor((payload.toDate.getTime() - payload.fromDate.getTime()) / MILLISECONDS_IN_MINUTE)

  // each filter will have separate sub dir based on it's sha hash

  let downloadOptions: DownloadOption[]
  if (payload.fineGrainCache) {
    downloadOptions = getDownloadOptionsFromFilters(payload.cacheDir, payload.exchange, filters)
  } else {
    const cacheDir = `${payload.cacheDir}/feeds/${payload.exchange}/${sha256(filters)}`
    downloadOptions = [{ cacheDir, filters }]
  }

  const concurrencyLimit = Math.floor(CONCURRENCY_LIMIT / downloadOptions.length)

  if (payload.waitWhenDataNotYetAvailable === undefined) {
    // fetch last slice - it will tell us if user has access to the end of requested date range and data is available
    await getDataFeedSlice(payload, minutesCountToFetch - 1, downloadOptions)
  }

  // fetch first slice - it will tell us if user has access to the beginning of requested date range
  await getDataFeedSlice(payload, 0, downloadOptions)
  const waitOffsetMS =
    typeof payload.waitWhenDataNotYetAvailable === 'number'
      ? payload.waitWhenDataNotYetAvailable * MILLISECONDS_IN_MINUTE
      : 30 * MILLISECONDS_IN_MINUTE

  if (payload.waitWhenDataNotYetAvailable !== undefined && payload.toDate.valueOf() > new Date().valueOf() - waitOffsetMS) {
    const timestampForLastAvailableData = new Date().valueOf() - waitOffsetMS

    const minutesCountTharAreAlreadyAvailableToFetch = Math.floor(
      (timestampForLastAvailableData - payload.fromDate.getTime()) / MILLISECONDS_IN_MINUTE
    )

    await pMap(sequence(minutesCountTharAreAlreadyAvailableToFetch, 1), (offset) => getDataFeedSlice(payload, offset, downloadOptions), {
      concurrency: concurrencyLimit
    })

    // for remaining data iterate one by one and wait as needed
    for (let offset = minutesCountTharAreAlreadyAvailableToFetch; offset < minutesCountToFetch; offset++) {
      const timestampToFetch = payload.fromDate.valueOf() + offset * MILLISECONDS_IN_MINUTE
      const timestampForLastAvailableData = new Date().valueOf() - waitOffsetMS

      if (timestampToFetch > timestampForLastAvailableData) {
        await wait(MILLISECONDS_IN_MINUTE)
      }
      await getDataFeedSlice(payload, offset, downloadOptions)
    }
  } else {
    // it both begining and end date of the range is accessible fetch all remaning slices concurently with CONCURRENCY_LIMIT
    await pMap(
      sequence(minutesCountToFetch, 1), // this will produce Iterable sequence from 1 to minutesCountToFetch
      (offset) => getDataFeedSlice(payload, offset, downloadOptions),
      { concurrency: concurrencyLimit }
    )
  }
}

async function getDataFeedSlice(workerJobPayload: WorkerJobPayload, offset: number, options: DownloadOption[]) {
  const sliceTimestamp = addMinutes(workerJobPayload.fromDate, offset)
  const sliceKey = sliceTimestamp.toISOString()
  const slicePaths = await Promise.all(options.map((option) => _getDataFeedSlice(workerJobPayload, offset, option)))
  const message: WorkerMessage = { sliceKey, slicePaths }

  // everything went well (already cached or successfull cached) let's communicate it to parent thread
  parentPort!.postMessage(message)
}

async function _getDataFeedSlice(
  { exchange, fromDate, endpoint, apiKey, userAgent }: WorkerJobPayload,
  offset: number,
  { cacheDir, filters }: DownloadOption
) {
  const sliceTimestamp = addMinutes(fromDate, offset)
  const sliceKey = sliceTimestamp.toISOString()
  const slicePath = `${cacheDir}/${formatDateToPath(sliceTimestamp)}.json.gz`
  const isCached = existsSync(slicePath)

  let url = `${endpoint}/data-feeds/${exchange}?from=${fromDate.toISOString()}&offset=${offset}`

  if (filters.length > 0) {
    url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`
  }

  if (!isCached) {
    await download({
      apiKey,
      downloadPath: slicePath,
      url,
      userAgent
    })

    debug('getDataFeedSlice fetched from API and cached, %s', sliceKey)
  } else {
    debug('getDataFeedSlice already cached: %s', sliceKey)
  }

  return slicePath
}

function getDownloadOptionsFromFilters(_cacheDir: string, exchange: string, filters: Filter<any>[]) {
  return filters.reduce((acc, filter) => {
    if (!filter.symbols) {
      const cacheDir = `${_cacheDir}/feeds/${exchange}/__all__/${filter.channel}`
      acc.push({ cacheDir, filters: [{ channel: filter.channel }] })
    } else {
      filter.symbols.forEach((symbol) => {
        const cacheDir = `${_cacheDir}/feeds/${exchange}/${symbol}/${filter.channel}`
        acc.push({ cacheDir, filters: [{ channel: filter.channel, symbols: [symbol] }] })
      })
    }
    return acc
  }, [] as DownloadOption[])
}

type DownloadOption = { cacheDir: string; filters: Filter<any>[] }

export type WorkerMessage = {
  sliceKey: string
  slicePaths: string[]
}

export type WorkerJobPayload = {
  cacheDir: string
  fineGrainCache: boolean
  endpoint: string
  apiKey: string
  userAgent: string
  fromDate: Date
  toDate: Date
  exchange: Exchange
  filters: Filter<any>[]
  waitWhenDataNotYetAvailable?: boolean | number
}
