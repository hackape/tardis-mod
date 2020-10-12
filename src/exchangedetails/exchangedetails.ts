import got from 'got'
import { getOptions } from '../options'
import { Exchange, FilterForExchange } from '../types'
import { MarketInfo, getMarketInfo } from './marketinfo'

export async function getExchangeDetails<T extends Exchange>(exchange: T) {
  const options = getOptions()
  const exchangeDetails = (await got.get(`${options.endpoint}/exchanges/${exchange}`).json()) as ExchangeDetails<T>
  const marketInfoDatabase = await getMarketInfo(exchange)
  if (marketInfoDatabase) {
    exchangeDetails.availableSymbols.forEach((symbol) => {
      marketInfoDatabase.mixin(exchange, symbol)
    })
  }
  return exchangeDetails
}

export type SymbolType = 'spot' | 'future' | 'perpetual' | 'option'

export type Stats = {
  trades: number
  bookChanges: number
}

export type DatasetType = 'trades' | 'incremental_book_L2' | 'quotes' | 'derivative_ticker' | 'options_chain'

type Datasets = {
  dataTypes: DatasetType[]
  formats: ['csv']
  exportedFrom: Date
  exportedUntil: Date
  stats: Stats
  symbols: {
    id: string
    type: SymbolType
    availableSince: string
    availableTo: string
    stats: Stats
  }[]
}

export type ExchangeDetailsBase<T extends Exchange> = {
  id: T
  name: string
  filterable: boolean
  enabled: boolean
  availableSince: string

  availableChannels: FilterForExchange[T]['channel'][]

  availableSymbols: {
    id: string
    type: SymbolType
    availableSince: string
    availableTo?: string
    name?: string
    market?: MarketInfo
  }[]

  incidentReports: {
    from: string
    to: string
    status: 'resolved' | 'wontfix'
    details: string
  }
}

type ExchangeDetails<T extends Exchange> =
  | (ExchangeDetailsBase<T> & { supportsDatasets: false })
  | (ExchangeDetailsBase<T> & { supportsDatasets: true; datasets: Datasets })
