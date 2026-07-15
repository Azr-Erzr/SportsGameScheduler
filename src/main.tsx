/* eslint-disable react-refresh/only-export-components -- entry file, not hot-reloaded */
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles/tailwind.css'
import { AppShell } from './app/AppShell'
import { AppStateProvider } from './app/state'
import { registerServiceWorker } from './lib/pwa'

function applyRuntimeBrowserFlags() {
  const isFirefox = /\b(Firefox|FxiOS|Focus)\//.test(navigator.userAgent)
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const compactScreen = window.matchMedia?.('(max-width: 899px)').matches ?? false

  document.documentElement.dataset.browser = isFirefox ? 'firefox' : 'enhanced'
  document.documentElement.dataset.visualEffects = isFirefox || reduceMotion || compactScreen ? 'reduced' : 'enhanced'
}

applyRuntimeBrowserFlags()
registerServiceWorker()

window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change', applyRuntimeBrowserFlags)
window.matchMedia?.('(max-width: 899px)').addEventListener('change', applyRuntimeBrowserFlags)

// PERF: keep the shell small. Page modules load by route; export studio pulls the canvas
// poster pipeline, sport pages pull banner assets, and Supabase loads only when configured.
const HomePage = lazy(() => import('./pages/Home').then((m) => ({ default: m.HomePage })))
const MySchedulePage = lazy(() => import('./pages/MySchedule').then((m) => ({ default: m.MySchedulePage })))
const SportPage = lazy(() => import('./pages/SportPage').then((m) => ({ default: m.SportPage })))
const OtherSportsPage = lazy(() => import('./pages/OtherSports').then((m) => ({ default: m.OtherSportsPage })))
const ExplorePage = lazy(() => import('./pages/Explore').then((m) => ({ default: m.ExplorePage })))
const ExportStudioPage = lazy(() => import('./pages/ExportStudio').then((m) => ({ default: m.ExportStudioPage })))
const CalendarFeedsPage = lazy(() => import('./pages/CalendarFeeds').then((m) => ({ default: m.CalendarFeedsPage })))
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
const AccountPage = lazy(() => import('./pages/Account').then((m) => ({ default: m.AccountPage })))
const PrivacyPage = lazy(() => import('./pages/Legal').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/Legal').then((m) => ({ default: m.TermsPage })))
const AboutPage = lazy(() => import('./pages/Content').then((m) => ({ default: m.AboutPage })))
const HowItWorksPage = lazy(() => import('./pages/Content').then((m) => ({ default: m.HowItWorksPage })))
const FaqPage = lazy(() => import('./pages/Content').then((m) => ({ default: m.FaqPage })))
const NotFoundPage = lazy(() => import('./pages/Content').then((m) => ({ default: m.NotFoundPage })))
const BlogIndexPage = lazy(() => import('./pages/Blog').then((m) => ({ default: m.BlogIndexPage })))
const BlogPostPage = lazy(() => import('./pages/Blog').then((m) => ({ default: m.BlogPostPage })))

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
      { path: '/other-sports', element: lazyRoute(<OtherSportsPage />) },
      { path: '/sports/:sportKey', element: lazyRoute(<SportPage />) },
      { path: '/sports/:sportKey/:leagueKey', element: lazyRoute(<SportPage />) },
      { path: '/leagues/:leagueId', element: lazyRoute(<LeaguePage />) },
      { path: '/teams/:teamId', element: lazyRoute(<TeamPage />) },
      { path: '/events/:eventId', element: lazyRoute(<EventDetailPage />) },
      { path: '/calendar', element: lazyRoute(<CalendarFeedsPage />) },
      { path: '/exports', element: lazyRoute(<ExportStudioPage />) },
      { path: '/settings/alerts', element: lazyRoute(<AlertSettingsPage />) },
      { path: '/admin', element: lazyRoute(<AdminPage />) },
      { path: '/account', element: lazyRoute(<AccountPage />) },
      { path: '/privacy', element: lazyRoute(<PrivacyPage />) },
      { path: '/terms', element: lazyRoute(<TermsPage />) },
      { path: '/about', element: lazyRoute(<AboutPage />) },
      { path: '/how-it-works', element: lazyRoute(<HowItWorksPage />) },
      { path: '/faq', element: lazyRoute(<FaqPage />) },
      { path: '/blog', element: lazyRoute(<BlogIndexPage />) },
      { path: '/blog/:slug', element: lazyRoute(<BlogPostPage />) },
      { path: '/custom-leagues', element: lazyRoute(<CustomLeaguesPage />) },
      { path: '/custom-leagues/:leagueId/admin', element: lazyRoute(<CustomLeagueAdminPage />) },
      { path: '/s/:token', element: lazyRoute(<SharePage />) },
      { path: '*', element: lazyRoute(<NotFoundPage />) },
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
