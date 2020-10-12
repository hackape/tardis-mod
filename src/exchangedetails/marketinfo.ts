import got from 'got'
import { Exchange } from '../types'

import { ExchangeDetailsBase } from './exchangedetails'

type AvailableSymbol = ExchangeDetailsBase<any>['availableSymbols'][number]

const marketInfoAPIs: { [key in Exchange]?: string } = {
  'binance-futures': 'https://fapi.binance.com/fapi/v1/exchangeInfo',
  'binance-delivery': 'https://dapi.binance.com/dapi/v1/exchangeInfo',
  'okex-swap': 'https://www.okex.com/api/swap/v3/instruments',
  'okex-futures': 'https://www.okex.com/api/futures/v3/instruments',
  'huobi-dm-swap': 'https://api.hbdm.com/swap-api/v1/swap_contract_info',
  'huobi-dm': 'https://api.hbdm.com/api/v1/contract_contract_info'
}

async function getRawMarketInfo<T extends Exchange>(exchange: T) {
  const url = marketInfoAPIs[exchange]
  if (!url) return
  const info: any = await got.get(url!).json()
  return { exchange, info } as MarketInfoResponse<T>
}

export async function getMarketInfo(exchange: Exchange) {
  const resp = await getRawMarketInfo(exchange)
  if (!resp) return

  const database = new MarketInfoDatabase()
  switch (resp.exchange) {
    case 'binance-futures': // all perpetual
    case 'binance-delivery': {
      // some perpetual, some delivery
      const symbols: MergeArrayElement<typeof resp.info.symbols> = resp.info.symbols
      symbols.forEach((symbol) => {
        const id = symbol.symbol

        let multiplier = 1
        let contractType: 'perpetual' | 'future' = 'perpetual'
        if ('contractSize' in symbol) {
          multiplier = symbol.contractSize
          contractType = symbol.contractType === 'PERPETUAL' ? 'perpetual' : 'future'
        }

        let contract: ContractInfo
        if (exchange === 'binance-delivery') {
          contract = {
            isInverse: true,
            unit: symbol.quoteAsset,
            multiplier
          }
        } else {
          contract = {
            isInverse: false,
            unit: symbol.baseAsset,
            multiplier
          }
        }

        database.add({
          id,
          type: contractType,
          base: symbol.baseAsset,
          quote: symbol.quoteAsset,
          precision: {
            price: symbol.pricePrecision,
            amount: symbol.quantityPrecision
          },
          contract
        })
      })

      break
    }

    case 'okex-swap':
    case 'okex-futures': {
      const contractType = resp.exchange === 'okex-swap' ? 'perpetual' : 'future'
      const symbols: MergeArrayElement<typeof resp.info> = resp.info
      symbols.forEach((symbol) => {
        const id = symbol.instrument_id.toLowerCase()
        const contract: ContractInfo = {
          isInverse: symbol.is_inverse === 'true',
          multiplier: Number(symbol.contract_val),
          unit: symbol.contract_val_currency
        }

        database.add({
          id,
          type: contractType,
          base: symbol.base_currency,
          quote: symbol.quote_currency,
          precision: {
            price: getDecimalPlaces(symbol.tick_size),
            amount: 0 // okex contract is traded in "cont", which is integer
          },
          contract
        })
      })

      break
    }

    case 'huobi-dm-swap':
    case 'huobi-dm': {
      const contractType = resp.exchange === 'huobi-dm' ? 'future' : 'perpetual'
      const symbols: MergeArrayElement<typeof resp.info.data> = resp.info.data
      symbols.forEach((symbol) => {
        const id = getHuobiSymbolKey(symbol).toLowerCase()
        database.add({
          id,
          type: contractType,
          base: symbol.symbol,
          quote: 'USD',
          precision: {
            price: getDecimalPlaces(symbol.price_tick),
            amount: 0
          },
          contract: {
            isInverse: true,
            multiplier: symbol.contract_size,
            unit: 'USD'
          }
        })
      })

      break
    }
  }

  console.log('database size', database.count - database.db.size)
  return database
}

class MarketInfoDatabase {
  db: Map<string, MarketInfoRecord> = new Map()

  count = 0

  add(record: MarketInfoRecord) {
    this.count++
    const key = `${record.base}_${record.quote}_${record.type}`.toLowerCase()
    if (this.db.has(key)) {
      const prevRecord = this.db.get(key)!
      const isEqual = compareMarketInfoRecord(prevRecord, record)
      if (!isEqual) {
        console.log(prevRecord)
        console.log(record)
        throw Error('wierd case')
      }
    } else {
      this.db.set(key, record)
    }
  }

  // @ts-ignore
  mixin(exchange: Exchange, symbol: AvailableSymbol) {
    const key = getRecordKeyForSymbol(exchange, symbol)
    const record = this.db.get(key!)
    if (record) {
      symbol.market = {
        base: record.base,
        quote: record.quote,
        precision: record.precision,
        contract: record.contract
      }
    } else {
      console.warn(`cannot find market info for ${exchange}:${symbol.id}`)
    }
    return symbol
  }
}

function compareMarketInfoRecord(a: MarketInfoRecord, b: MarketInfoRecord) {
  const symbolInfoIsEqual =
    a.base === b.base &&
    a.quote === b.quote &&
    a.type === b.type &&
    a.precision.price === b.precision.price &&
    a.precision.amount === b.precision.amount
  if (a.contract && b.contract) {
    const contractInfoIsEqual =
      a.contract.isInverse === b.contract.isInverse &&
      a.contract.multiplier === b.contract.multiplier &&
      a.contract.unit === b.contract.unit
    return contractInfoIsEqual && symbolInfoIsEqual
  } else {
    // this is impossible
    throw Error('missing contract field')
  }
}

type RawMarketInfoMap = {
  'okex-swap': OkexSwap.MarketInfo
  'okex-futures': OkexFutures.MarketInfo
  'huobi-dm': HuobiDm.MarketInfo
  'huobi-dm-swap': HuobiDmSwap.MarketInfo
  'binance-futures': BinanceFutures.MarketInfo
  'binance-delivery': BinanceDelivery.MarketInfo
}

type MarketInfoResponse<T extends Exchange> = T extends keyof RawMarketInfoMap ? { exchange: T; info: RawMarketInfoMap[T] } : undefined

type ContractInfo = {
  isInverse: boolean
  multiplier: number
  unit: string
}

export interface MarketInfo {
  base: string
  quote: string
  precision: {
    price: number
    amount: number
  }
  contract?: ContractInfo
}

interface MarketInfoRecord extends MarketInfo {
  id: string
  type: 'perpetual' | 'future'
}

type MergeArrayElement<T> = Array<T extends Array<any> ? T[number] : never>

function getDecimalPlaces(x: number | string) {
  if (typeof x === 'string') x = Number(x)
  const decimals = String(x).split('.')[1]
  return decimals ? decimals.length : 0
}

function getHuobiSymbolKey(symbol: HuobiDm.Symbol | HuobiDmSwap.Symbol) {
  if ('contract_type' in symbol) {
    switch (symbol.contract_type) {
      case 'this_week':
        return `${symbol.symbol}_CW`
      case 'next_week':
        return `${symbol.symbol}_NW`
      case 'quarter':
        return `${symbol.symbol}_CQ`
      case 'next_quarter':
        return `${symbol.symbol}_NQ`
    }
  } else {
    return symbol.contract_code
  }
}

function getRecordKeyForSymbol(exchange: Exchange, symbol: AvailableSymbol) {
  let symbolId = symbol.id
  const type = symbol.type

  switch (exchange) {
    case 'binance-futures': {
      // "btcusdt"
      return `${symbolId.slice(0, -4)}_usdt_${type}`.toLowerCase()
    }
    case 'binance-delivery': {
      // "btcusd_perp" or "btcusd_210326"
      symbolId = symbolId.slice(0, symbolId.indexOf('_'))
      return `${symbolId.slice(0, -3)}_usd_${type}`.toLowerCase()
    }
    case 'okex-swap':
    case 'okex-futures': {
      const parts = symbolId.split('-')
      return `${parts[0]}_${parts[1]}_${type}`.toLowerCase()
    }
    case 'huobi-dm': {
      // "BTC_CW"
      return `${symbolId.slice(0, -3)}_usd_${type}`.toLowerCase()
    }
    case 'huobi-dm-swap': {
      // "BTC-USD"
      return `${symbolId.replace('-', '_')}_${type}`.toLowerCase()
    }
  }

  return
}
