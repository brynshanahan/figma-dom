export interface ApiOpts {
  /** Can be branch key or file key */
  key: string
  branchName?: string
  apiKey: string
  cache?:
    | false
    | {
        get(key: string): Promise<any>
        set(key: string, value: any): Promise<void>
      }
}
