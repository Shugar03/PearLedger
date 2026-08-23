import { useContext } from 'react'

import { PearContext, type PearContextValue } from '@dashboard/context/pear-context'

export function usePear(): PearContextValue {
  const value = useContext(PearContext)
  if (value === null) throw new Error('usePear() fuera de <PearProvider>')
  return value
}
