// Local development only: stand-ins for the DM's notebook and log in the design previews.

import { useState } from 'react'
import type { LogEvent, Notebook } from '../../live/notebook.ts'
import type { NotebookControls } from '../../live/useNotebook.ts'
import type { LogControls } from '../../live/useStage.ts'

export function sampleNotebook(): Notebook {
  return {
    whereWeAre:
      'The party has just reached the tavern, looking for the missing merchant. The innkeeper knows more than he says.',
    nextSteps: [
      { id: 's1', text: 'Arrive and meet the innkeeper', done: true },
      { id: 's2', text: 'Hear the rumour about the ruins', done: false },
      { id: 's3', text: 'A bar fight breaks out', done: false },
    ],
    keyItems: [
      { id: 'k1', name: 'Silver key', holder: '' },
      { id: 'k2', name: 'Merchant’s ledger', holder: 'Elowen has it' },
    ],
  }
}

export function usePreviewNotebook(): NotebookControls {
  const [notebook, setNotebook] = useState(sampleNotebook)
  return { notebook, status: 'ready', change: setNotebook, saving: false, error: null }
}

export function usePreviewEvents(): LogControls {
  const [events, setEvents] = useState<LogEvent[]>([])
  return {
    events,
    error: null,
    add: (kind, text, visible = false) =>
      setEvents((now) => [
        {
          id: `event-${now.length + 1}`,
          campaignId: 'preview',
          kind,
          text,
          visible,
          createdAt: new Date().toISOString(),
        },
        ...now,
      ]),
  }
}
