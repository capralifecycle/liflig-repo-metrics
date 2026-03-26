export interface SystemsDefinition {
  customers: Customer[]
}

export interface Customer {
  name: string
  systems: System[]
}

export interface System {
  name: string
  repos: string[]
}

// Lookup map value: repo name -> { customer, system }
export interface RepoSystemMapping {
  customer: string
  system: string
}
