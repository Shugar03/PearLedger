import type { ReactNode } from 'react'

import { Icon } from '@dashboard/components/Icon'
import { usePrefs } from '@dashboard/hooks/usePrefs'
import type { Problem } from '@dashboard/hooks/useToolResult'

/**
 * El motivo de un fallo o de un bloqueo, a la vista.
 *
 * Un mensaje vacío también se dibuja: que el harness no explique por qué frenó
 * algo es información, y esconder el aviso sería peor que mostrarlo pelado.
 */
export function Notice({ problem }: { problem: Problem }): ReactNode {
  const { t } = usePrefs()
  const message = problem.message.trim() || t.common.noReason

  return (
    <p className={problem.tone === 'error' ? 'notice notice--error' : 'notice notice--warn'}>
      <Icon name="alert" size={16} />
      <span>
        <b>{problem.tone === 'error' ? t.common.failed : t.common.blocked}</b> {message}
      </span>
    </p>
  )
}
