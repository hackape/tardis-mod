// https://www.okex.com/api/futures/v3/instruments
declare module OkexFutures {
  export interface Symbol {
    instrument_id: string
    underlying_index: string
    quote_currency: string
    tick_size: string
    contract_val: string
    listing: string
    delivery: string
    trade_increment: string
    alias: string
    underlying: string
    base_currency: string
    settlement_currency: string
    is_inverse: string
    contract_val_currency: string
    category: string
  }

  export type MarketInfo = Symbol[]
}
