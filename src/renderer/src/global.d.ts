import type { LplApi } from '../../shared/domain'

declare global {
  interface Window {
    lpl: LplApi
  }
}
