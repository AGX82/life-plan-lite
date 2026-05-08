import type { BirthdayBoardView, ColumnType, CurrencyCode, WishlistRecommendationProfile } from '@shared/domain'

export const columnTypes: ColumnType[] = ['text', 'integer', 'decimal', 'currency', 'duration', 'date', 'boolean', 'choice', 'hyperlink']

export const currencyOptions: Array<{ code: CurrencyCode; label: string }> = [
  { code: 'RON', label: 'RON - Romanian leu' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'USD', label: 'USD - US dollar' },
  { code: 'GBP', label: 'GBP - Pound sterling' },
  { code: 'CNY', label: 'CNY - Chinese yuan' },
  { code: 'JPY', label: 'JPY - Japanese yen' },
  { code: 'CAD', label: 'CAD - Canadian dollar' },
  { code: 'AUD', label: 'AUD - Australian dollar' },
  { code: 'CHF', label: 'CHF - Swiss franc' },
  { code: 'PLN', label: 'PLN - Polish zloty' }
]

export const birthdayBoardViewOptions: Array<{ value: BirthdayBoardView; label: string }> = [
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'next_10_days', label: 'Next 10 days' },
  { value: 'next_30_days', label: 'Next 30 days' },
  { value: 'next_2_months', label: 'Next 2 months' },
  { value: 'all', label: 'All birthdays' }
]

export const wishlistRecommendationProfileOptions: Array<{
  value: WishlistRecommendationProfile
  label: string
  description: string
}> = [
  { value: 'default', label: 'Default', description: 'Wish-led recommendation for typical wishlist planning.' },
  { value: 'balanced', label: 'Balanced', description: 'Wish, priority, and price all influence the result materially.' },
  { value: 'priority_first', label: 'Priority First', description: 'Practical importance has the strongest voice.' },
  { value: 'value_first', label: 'Value First', description: 'Price efficiency leads, with wish mostly breaking ties.' }
]
