import { useEffect, type ReactNode } from 'react'
import { LoadingScreen } from '../components/LoadingScreen.tsx'
import { CampaignScreen } from '../screens/campaign/CampaignScreen.tsx'
import { NewCampaignScreen } from '../screens/campaign/NewCampaignScreen.tsx'
import { CreditsScreen } from '../screens/credits/CreditsScreen.tsx'
import { CharacterEditorScreen } from '../screens/character/CharacterEditorScreen.tsx'
import { CheckEmailPreview } from '../screens/dev/CheckEmailPreview.tsx'
import { CharacterFormPreview, JoinScreenPreview, TablePreview } from '../screens/dev/JoinScreenPreview.tsx'
import { SheetScreen } from '../screens/sheet/SheetScreen.tsx'
import { TableScreen } from '../screens/table/TableScreen.tsx'
import { JoinByCodeScreen } from '../screens/join/JoinByCodeScreen.tsx'
import { NotConnectedScreen } from '../screens/NotConnectedScreen.tsx'
import { NotFoundScreen } from '../screens/NotFoundScreen.tsx'
import { ProgressScreen } from '../screens/progress/ProgressScreen.tsx'
import { SignInScreen } from '../screens/signin/SignInScreen.tsx'
import { TablesScreen } from '../screens/tables/TablesScreen.tsx'
import { useAuth } from './authContext.ts'
import { AuthProvider } from './AuthProvider.tsx'
import { matchRoute, useHashPath } from './router.ts'

type Route = {
  pattern: string
  title: string
  /** Screens that need someone signed in show the sign-in screen first, then come back here. */
  signedIn?: boolean
  render: (params: Record<string, string>) => ReactNode
}

const APP_NAME = 'D&D Table'

const ROUTES: Route[] = [
  { pattern: '/', title: APP_NAME, signedIn: true, render: () => <TablesScreen /> },
  { pattern: '/new', title: `Start a campaign · ${APP_NAME}`, signedIn: true, render: () => <NewCampaignScreen /> },
  {
    pattern: '/join/:code',
    title: `Join a table · ${APP_NAME}`,
    signedIn: true,
    render: ({ code }) => <JoinByCodeScreen key={code} code={code} />,
  },
  {
    pattern: '/c/:campaignId',
    title: APP_NAME,
    signedIn: true,
    render: ({ campaignId }) => <CampaignScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    pattern: '/c/:campaignId/play',
    title: APP_NAME,
    signedIn: true,
    render: ({ campaignId }) => <TableScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    pattern: '/c/:campaignId/character/new',
    title: `Your character · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId }) => <CharacterEditorScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    pattern: '/c/:campaignId/character/:characterId/edit',
    title: `Edit character · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId, characterId }) => (
      <CharacterEditorScreen key={characterId} campaignId={campaignId} characterId={characterId} />
    ),
  },
  {
    pattern: '/c/:campaignId/sheet/:characterId',
    title: `Character sheet · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId, characterId }) => (
      <SheetScreen key={characterId} campaignId={campaignId} characterId={characterId} />
    ),
  },
  { pattern: '/progress', title: `Build progress · ${APP_NAME}`, render: () => <ProgressScreen /> },
  { pattern: '/credits', title: `Credits · ${APP_NAME}`, render: () => <CreditsScreen /> },
  // Design previews with made-up data, only under `npm run dev`; the live build leaves them out.
  ...(import.meta.env.DEV
    ? [
        { pattern: '/dev/check-email', title: `Check email preview · ${APP_NAME}`, render: () => <CheckEmailPreview /> },
        {
          pattern: '/dev/join/:as',
          title: `Join preview · ${APP_NAME}`,
          render: ({ as }: Record<string, string>) => <JoinScreenPreview as={as} />,
        },
        { pattern: '/dev/table', title: `Table preview · ${APP_NAME}`, render: () => <TablePreview /> },
        { pattern: '/dev/character', title: `Character form preview · ${APP_NAME}`, render: () => <CharacterFormPreview /> },
      ]
    : []),
]

export function App() {
  return (
    <AuthProvider>
      <Screens />
    </AuthProvider>
  )
}

function Screens() {
  const path = useHashPath()
  const auth = useAuth()
  const found = findRoute(path)
  const title = found?.route.title ?? `Lost in the fog · ${APP_NAME}`

  useEffect(() => {
    document.title = title
    window.scrollTo(0, 0)
  }, [path, title])

  // Wait for sign-in to settle first: a login link briefly leaves its details after the '#'.
  if (auth.status === 'loading') return <LoadingScreen />
  if (!found) return <NotFoundScreen />
  if (found.route.signedIn && auth.status === 'unavailable') return <NotConnectedScreen />
  if (found.route.signedIn && auth.status === 'signedOut') {
    return <SignInScreen key={path} next={path} loginError={auth.loginError} />
  }
  return found.route.render(found.params)
}

function findRoute(path: string) {
  for (const route of ROUTES) {
    const params = matchRoute(route.pattern, path)
    if (params) return { route, params }
  }
  return null
}
