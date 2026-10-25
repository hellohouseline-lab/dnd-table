import { useEffect, type ReactNode } from 'react'
import { CreditsScreen } from '../screens/credits/CreditsScreen.tsx'
import { HomeScreen } from '../screens/home/HomeScreen.tsx'
import { NotFoundScreen } from '../screens/NotFoundScreen.tsx'
import { matchRoute, useHashPath } from './router.ts'

type Route = {
  pattern: string
  title: string
  render: (params: Record<string, string>) => ReactNode
}

const APP_NAME = 'D&D Table'

const ROUTES: Route[] = [
  { pattern: '/', title: APP_NAME, render: () => <HomeScreen /> },
  { pattern: '/credits', title: `Credits · ${APP_NAME}`, render: () => <CreditsScreen /> },
]

export function App() {
  const path = useHashPath()
  const found = findRoute(path)
  const title = found?.route.title ?? `Lost in the fog · ${APP_NAME}`

  useEffect(() => {
    document.title = title
    window.scrollTo(0, 0)
  }, [path, title])

  return found ? found.route.render(found.params) : <NotFoundScreen />
}

function findRoute(path: string) {
  for (const route of ROUTES) {
    const params = matchRoute(route.pattern, path)
    if (params) return { route, params }
  }
  return null
}
