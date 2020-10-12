// https://www.okex.com/api/swap/v3/instruments
declare module OkexSwap {
  export interface Symbol {
    instrument_id: string
    underlying_index: string
    quote_currency: string
    coin: string
    contract_val: string
    listing: Date
    delivery: Date
    size_increment: string
    tick_size: string
    base_currency: string
    underlying: string
    settlement_currency: string
    is_inverse: string
    contract_val_currency: string
    category: string
  }

  export type MarketInfo = Symbol[]
}
