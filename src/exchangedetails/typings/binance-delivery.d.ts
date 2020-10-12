// https://dapi.binance.com/dapi/v1/exchangeInfo
declare module BinanceDelivery {
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
    pair: string
    contractType: string
    deliveryDate: any
    onboardDate: any
    contractStatus: string
    contractSize: number
    marginAsset: string
    maintMarginPercent: string
    requiredMarginPercent: string
    baseAsset: string
    quoteAsset: string
    pricePrecision: number
    quantityPrecision: number
    baseAssetPrecision: number
    quotePrecision: number
    equalQtyPrecision: number
    triggerProtect: string
    underlyingType: string
    underlyingSubType: any[]
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
