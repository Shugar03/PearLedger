import { useContext } from 'react'

import { PrefsContext, type PrefsValue } from '@dashboard/context/prefs-context'

export function usePrefs(): PrefsValue {
  const value = useContext(PrefsContext)
  if (value === null) throw new Error('usePrefs() fuera de <PrefsProvider>')
  return value
}
