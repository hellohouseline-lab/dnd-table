import { useEffect, type ReactNode } from 'react'
import { CallProvider } from '../call/CallProvider.tsx'
import { LoadingScreen } from '../components/LoadingScreen.tsx'
import { CampaignScreen } from '../screens/campaign/CampaignScreen.tsx'
import { NewCampaignScreen } from '../screens/campaign/NewCampaignScreen.tsx'
import { CreditsScreen } from '../screens/credits/CreditsScreen.tsx'
import { BuilderScreen } from '../screens/builder/BuilderScreen.tsx'
import { LevelUpScreen } from '../screens/builder/LevelUpScreen.tsx'
import { CharacterEditorScreen } from '../screens/character/CharacterEditorScreen.tsx'
import { ManageScreen } from '../screens/manage/ManageScreen.tsx'
import { BattlePreview } from '../screens/dev/BattlePreview.tsx'
import { CallPreview } from '../screens/dev/CallPreview.tsx'
import { CheckEmailPreview } from '../screens/dev/CheckEmailPreview.tsx'
import { DmPreview } from '../screens/dev/DmPreview.tsx'
import { StagePreview } from '../screens/dev/StagePreview.tsx'
import { RollsForDmPreview } from '../screens/dev/RollsForDmPreview.tsx'
import { BuilderPreview } from '../screens/dev/BuilderPreview.tsx'
import { LevelUpPreview } from '../screens/dev/LevelUpPreview.tsx'
import { ManagePreview } from '../screens/dev/ManagePreview.tsx'
import { CharacterFormPreview, JoinScreenPreview, TablePreview } from '../screens/dev/JoinScreenPreview.tsx'
import { SheetScreen } from '../screens/sheet/SheetScreen.tsx'
import { DmScreen } from '../screens/dm/DmScreen.tsx'
import { StageScreen } from '../screens/stage/StageScreen.tsx'
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
    pattern: '/c/:campaignId/dm',
    title: `DM screen · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId }) => <DmScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    pattern: '/c/:campaignId/stage',
    title: `The Stage · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId }) => <StageScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    pattern: '/c/:campaignId/play',
    title: APP_NAME,
    signedIn: true,
    render: ({ campaignId }) => <TableScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    pattern: '/c/:campaignId/build',
    title: `Make your character · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId }) => <BuilderScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    pattern: '/c/:campaignId/level-up',
    title: `Level up · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId }) => <LevelUpScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    pattern: '/c/:campaignId/character/new',
    title: `Make your character · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId }) => <BuilderScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    // The plain form, for anyone who'd rather type their sheet in.
    pattern: '/c/:campaignId/character/new/form',
    title: `Your character · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId }) => <CharacterEditorScreen key={campaignId} campaignId={campaignId} />,
  },
  {
    pattern: '/c/:campaignId/character/:characterId/edit',
    title: `Change your character · ${APP_NAME}`,
    signedIn: true,
    render: ({ campaignId, characterId }) => (
      <ManageScreen key={characterId} campaignId={campaignId} characterId={characterId} />
    ),
  },
  {
    // Type anything in by hand.
    pattern: '/c/:campaignId/character/:characterId/form',
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
        {
          pattern: '/dev/check-email',
          title: `Check email preview · ${APP_NAME}`,
          render: () => <CheckEmailPreview />,
        },
        {
          pattern: '/dev/join/:as',
          title: `Join preview · ${APP_NAME}`,
          render: ({ as }: Record<string, string>) => <JoinScreenPreview as={as} />,
        },
        { pattern: '/dev/table', title: `Table preview · ${APP_NAME}`, render: () => <TablePreview /> },
        {
          pattern: '/dev/table/fight',
          title: `Table preview · ${APP_NAME}`,
          render: () => <TablePreview key="fight" fighting />,
        },
        {
          pattern: '/dev/table/reaction',
          title: `Table preview · ${APP_NAME}`,
          render: () => <TablePreview key="reaction" fighting variant="reaction" />,
        },
        {
          pattern: '/dev/table/caster',
          title: `Table preview · ${APP_NAME}`,
          render: () => <TablePreview key="caster" fighting variant="caster" />,
        },
        {
          pattern: '/dev/table/dual',
          title: `Table preview · ${APP_NAME}`,
          render: () => <TablePreview key="dual" fighting variant="dual" />,
        },
        {
          pattern: '/dev/table/story',
          title: `Table preview · ${APP_NAME}`,
          render: () => <TablePreview key="story" variant="story" />,
        },
        {
          pattern: '/dev/table/gift',
          title: `Table preview · ${APP_NAME}`,
          render: () => <TablePreview key="gift" variant="gift" />,
        },
        {
          pattern: '/dev/table/rules',
          title: `Table preview · ${APP_NAME}`,
          render: () => <TablePreview key="rules" variant="rules" />,
        },
        {
          pattern: '/dev/table/dying',
          title: `Table preview · ${APP_NAME}`,
          render: () => <TablePreview key="dying" fighting variant="dying" />,
        },
        {
          pattern: '/dev/table/asked',
          title: `Table preview · ${APP_NAME}`,
          render: () => <TablePreview key="asked" asked />,
        },
        { pattern: '/dev/stage', title: `Stage preview · ${APP_NAME}`, render: () => <StagePreview /> },
        { pattern: '/dev/level-up', title: `Level up preview · ${APP_NAME}`, render: () => <LevelUpPreview /> },
        {
          pattern: '/dev/level-up/:who',
          title: `Level up preview · ${APP_NAME}`,
          render: ({ who }: Record<string, string>) => <LevelUpPreview who={who} />,
        },
        {
          pattern: '/dev/change/:who',
          title: `Change your character preview · ${APP_NAME}`,
          render: ({ who }: Record<string, string>) => <ManagePreview who={who} />,
        },
        {
          pattern: '/dev/dm-rolls',
          title: `Rolls for the DM preview · ${APP_NAME}`,
          render: () => <RollsForDmPreview />,
        },
        { pattern: '/dev/builder', title: `Builder preview · ${APP_NAME}`, render: () => <BuilderPreview /> },
        { pattern: '/dev/battle', title: `Battle preview · ${APP_NAME}`, render: () => <BattlePreview /> },
        {
          pattern: '/dev/call/:who/:run',
          title: `Call preview · ${APP_NAME}`,
          render: ({ who, run }: Record<string, string>) => <CallPreview key={`${who}:${run}`} who={who} run={run} />,
        },
        {
          pattern: '/dev/dm/:tab',
          title: `DM screen preview · ${APP_NAME}`,
          render: ({ tab }: Record<string, string>) => <DmPreview tab={tab} />,
        },
        {
          pattern: '/dev/character',
          title: `Character form preview · ${APP_NAME}`,
          render: () => <CharacterFormPreview />,
        },
      ]
    : []),
]

export function App() {
  return (
    <AuthProvider>
      <CallProvider>
        <Screens />
      </CallProvider>
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
