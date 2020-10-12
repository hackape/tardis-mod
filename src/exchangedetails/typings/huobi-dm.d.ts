// https://api.hbdm.com/api/v1/contract_contract_info
declare module HuobiDm {
  export interface Symbol {
    symbol: string
    contract_code: string
    contract_type: 'this_week' | 'next_week' | 'quarter' | 'next_quarter'
    contract_size: number
    price_tick: number
    create_date: string
    delivery_date: string
    contract_status: number
  }

  export interface MarketInfo {
    status: string
    data: Symbol[]
    ts: number
  }
}
