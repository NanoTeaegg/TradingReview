import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ACCOUNT_STORAGE_KEY = 'trading-review.current-account-id'
const ACCOUNT_CHANGE_EVENT = 'trading-review.account-change'

function readAccountId(): number | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function getStoredAccountId(): number | null {
  return readAccountId()
}

export function setStoredAccountId(accountId: number | null) {
  if (typeof window === 'undefined') return
  if (accountId == null) {
    window.localStorage.removeItem(ACCOUNT_STORAGE_KEY)
  } else {
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, String(accountId))
  }
  window.dispatchEvent(new CustomEvent(ACCOUNT_CHANGE_EVENT))
}

const AccountContext = createContext<{
  accountId: number | null
  setAccountId: (accountId: number | null) => void
} | null>(null)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accountId, setAccountIdState] = useState<number | null>(() => readAccountId())

  useEffect(() => {
    const sync = () => setAccountIdState(readAccountId())
    window.addEventListener('storage', sync)
    window.addEventListener(ACCOUNT_CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(ACCOUNT_CHANGE_EVENT, sync)
    }
  }, [])

  const value = useMemo(
    () => ({
      accountId,
      setAccountId: setStoredAccountId,
    }),
    [accountId],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useCurrentAccountId() {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useCurrentAccountId must be used within AccountProvider')
  }
  return context.accountId
}

export function useSetCurrentAccountId() {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useSetCurrentAccountId must be used within AccountProvider')
  }
  return context.setAccountId
}
