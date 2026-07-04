import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-mono text-primary">404</h1>
        <h2 className="mt-4 font-display text-2xl">Signal perdu</h2>
        <p className="mt-2 text-sm text-muted-foreground">La route demandée est hors de portée du moniteur.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 glow-primary">Retour au moniteur</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl">Exception d'exécution</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary">Réessayer</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5" },
      { name: "theme-color", content: "#0b1418" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Denoiz" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "Denoiz — Clean Signal, Safe Life" },
      { name: "description", content: "Denoiz est une plateforme de monitoring ECG temps réel avec streaming Bluetooth, visualisation d'ondes, analyse HRV et détection d'arythmies." },
      { property: "og:title", content: "Denoiz — Clean Signal, Safe Life" },
      { property: "og:description", content: "Monitoring ECG temps réel, streaming Bluetooth, HRV, détection QRS et arythmies." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/denoiz-logo.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/denoiz-logo.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/jpeg", href: "/denoiz-logo.jpg" },
      { rel: "apple-touch-icon", href: "/denoiz-logo.jpg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
    scripts: [
      {
        children: `try{var t=localStorage.getItem('denoiz.theme');if(t!=='light'){document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
