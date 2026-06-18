/* eslint-disable react-refresh/only-export-components -- entry file, not hot-reloaded */
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './styles/tailwind.css'
import { AppShell } from './app/AppShell'
import { AppStateProvider } from './app/state'

// PERF: keep the shell small. Page modules load by route; export studio pulls the canvas
// poster pipeline, sport pages pull banner assets, and Supabase loads only when configured.
const HomePage = lazy(() => import('./pages/Home').then((m) => ({ default: m.HomePage })))
const MySchedulePage = lazy(() => import('./pages/MySchedule').then((m) => ({ default: m.MySchedulePage })))
const SportPage = lazy(() => import('./pages/SportPage').then((m) => ({ default: m.SportPage })))
const ExplorePage = lazy(() => import('./pages/Explore').then((m) => ({ default: m.ExplorePage })))
const CalendarFeedsPage = lazy(() => import('./pages/CalendarFeeds').then((m) => ({ default: m.CalendarFeedsPage })))
const ExportStudioPage = lazy(() => import('./pages/ExportStudio').then((m) => ({ default: m.ExportStudioPage })))
const CustomLeaguesPage = lazy(() => import('./pages/CustomLeagues').then((m) => ({ default: m.CustomLeaguesPage })))
const CustomLeagueAdminPage = lazy(() =>
  import('./pages/CustomLeagueAdmin').then((m) => ({ default: m.CustomLeagueAdminPage })),
)
const SharePage = lazy(() => import('./pages/SharePage').then((m) => ({ default: m.SharePage })))
const LeaguePage = lazy(() => import('./pages/EntityPlaceholder').then((m) => ({ default: m.LeaguePage })))
const TeamPage = lazy(() => import('./pages/EntityPlaceholder').then((m) => ({ default: m.TeamPage })))
const EventDetailPage = lazy(() => import('./pages/EventDetail').then((m) => ({ default: m.EventDetailPage })))
const AlertSettingsPage = lazy(() => import('./pages/AlertSettings').then((m) => ({ default: m.AlertSettingsPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))

function lazyRoute(element: React.ReactNode) {
  return (
    <Suspense
      fallback={
        <p className="board-label px-2 py-10 text-center text-ink/50" role="status">
          Tuning channel…
        </p>
      }
    >
      {element}
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: lazyRoute(<HomePage />) },
      { path: '/my-schedule', element: lazyRoute(<MySchedulePage />) },
      { path: '/explore', element: lazyRoute(<ExplorePage />) },
      { path: '/sports/:sportKey', element: lazyRoute(<SportPage />) },
      { path: '/sports/:sportKey/:leagueKey', element: lazyRoute(<SportPage />) },
      { path: '/leagues/:leagueId', element: lazyRoute(<LeaguePage />) },
      { path: '/teams/:teamId', element: lazyRoute(<TeamPage />) },
      { path: '/events/:eventId', element: lazyRoute(<EventDetailPage />) },
      { path: '/calendar', element: lazyRoute(<CalendarFeedsPage />) },
      { path: '/exports', element: lazyRoute(<ExportStudioPage />) },
      { path: '/settings/alerts', element: lazyRoute(<AlertSettingsPage />) },
      { path: '/admin', element: lazyRoute(<AdminPage />) },
      { path: '/custom-leagues', element: lazyRoute(<CustomLeaguesPage />) },
      { path: '/custom-leagues/:leagueId/admin', element: lazyRoute(<CustomLeagueAdminPage />) },
      { path: '/s/:token', element: lazyRoute(<SharePage />) },
      { path: '*', element: <Navigate to="/my-schedule" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <RouterProvider router={router} />
    </AppStateProvider>
  </StrictMode>,
)
