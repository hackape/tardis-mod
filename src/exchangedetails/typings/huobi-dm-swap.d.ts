// https://api.hbdm.com/swap-api/v1/swap_contract_info
declare module HuobiDmSwap {
  export interface Symbol {
    symbol: string
    contract_code: string
    contract_size: number
    price_tick: number
    create_date: string
    settlement_date: string
    contract_status: number
  }

  export interface MarketInfo {
    status: string
    data: Symbol[]
    ts: number
  }
}
