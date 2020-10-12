// https://fapi.binance.com/fapi/v1/exchangeInfo
declare module BinanceFutures {
  export interface RateLimit {
    rateLimitType: string
    interval: string
    intervalNum: number
    limit: number
  }

  export interface Filter {
    minPrice: string
    maxPrice: string
    filterType: string
    tickSize: string
    stepSize: string
    maxQty: string
    minQty: string
    limit?: number
    multiplierDown: string
    multiplierUp: string
    multiplierDecimal: string
  }

  export interface Symbol {
    symbol: string
    status: string
    maintMarginPercent: string
    requiredMarginPercent: string
    baseAsset: string
    quoteAsset: string
    pricePrecision: number
    quantityPrecision: number
    baseAssetPrecision: number
    quotePrecision: number
    underlyingType: string
    underlyingSubType: string[]
    settlePlan: number
    triggerProtect: string
    filters: Filter[]
    orderTypes: string[]
    timeInForce: string[]
  }

  export interface MarketInfo {
    timezone: string
    serverTime: number
    rateLimits: RateLimit[]
    exchangeFilters: any[]
    symbols: Symbol[]
  }
}
