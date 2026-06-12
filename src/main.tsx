import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './styles/tailwind.css'
import { AppShell } from './app/AppShell'
import { AppStateProvider } from './app/state'
import { CalendarFeedsPage } from './pages/CalendarFeeds'
import { CustomLeagueAdminPage } from './pages/CustomLeagueAdmin'
import { CustomLeaguesPage } from './pages/CustomLeagues'
import { EventDetailPage, LeaguePage, TeamPage } from './pages/EntityPlaceholder'
import { ExplorePage } from './pages/Explore'
import { ExportStudioPage } from './pages/ExportStudio'
import { HomePage } from './pages/Home'
import { MySchedulePage } from './pages/MySchedule'
import { SharePage } from './pages/SharePage'
import { SportPage } from './pages/SportPage'

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/my-schedule', element: <MySchedulePage /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/sports/:sportKey', element: <SportPage /> },
      { path: '/sports/:sportKey/:leagueKey', element: <SportPage /> },
      { path: '/leagues/:leagueId', element: <LeaguePage /> },
      { path: '/teams/:teamId', element: <TeamPage /> },
      { path: '/events/:eventId', element: <EventDetailPage /> },
      { path: '/calendar', element: <CalendarFeedsPage /> },
      { path: '/exports', element: <ExportStudioPage /> },
      { path: '/custom-leagues', element: <CustomLeaguesPage /> },
      { path: '/custom-leagues/:leagueId/admin', element: <CustomLeagueAdminPage /> },
      { path: '/s/:token', element: <SharePage /> },
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
