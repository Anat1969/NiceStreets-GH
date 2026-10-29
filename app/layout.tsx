import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CITY } from "@/lib/city";
import TabBar from "@/components/TabBar";
import AIMenu from "@/components/AIMenu";
import Script from "next/script";
import Link from "next/link";
import { getPalette, getViewMode, isStaff } from "@/lib/session";
import { PALETTE_THEME_COLOR } from "@/lib/palette";
import { getStore } from "@/lib/store";
import { BUILD_LABEL } from "@/lib/version";
import { imageSlot, imageSlotUrl } from "@/lib/content-images";

export const metadata: Metadata = {
  title: CITY.appTitle,
  description: CITY.tagline,
  manifest: "/manifest.webmanifest",
  applicationName: CITY.appShortTitle,
};

/*
 * themeColor is deliberately not set here: it is static, and the colour has
 * to follow the scheme the visitor chose. It is rendered in <head> below,
 * from the same cookie the rest of the scheme comes from.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [staff, viewMode, palette] = await Promise.all([
    isStaff(),
    getViewMode(),
    getPalette(),
  ]);
  // Read the queue only for staff; the public pages must not pay for it.
  const pendingPhotos = staff
    ? await getStore()
        .listPhotos({ status: "pending" })
        .then((rows) => rows.length)
        .catch(() => 0)
    : 0;
  /*
   * The logo is uploaded in place from the dashboard, so it lives in the
   * database rather than in public/. CITY.logo stays as the fallback for a
   * file that ships with the build.
   */
  const uploadedLogo = await getStore()
    .listContentImageSlots()
    .then((slots) => slots.includes(imageSlot("logo")))
    .catch(() => false);
  const logoSrc = uploadedLogo ? imageSlotUrl(imageSlot("logo")) : CITY.logo;

  return (
    <html lang="he" dir="rtl" data-view={viewMode} data-palette={palette}>
      <head>
        <meta name="theme-color" content={PALETTE_THEME_COLOR[palette]} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/*
          The rule below targets the pages router's _document; in the app
          router this link is the supported way to load a stylesheet in head.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Hebrew:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <Script src="https://appofapp-gh.vercel.app/ai-menu.js" strategy="beforeInteractive" />
      </head>
      <body>
        <a className="skip-link" href="#main">
          דילוג לתוכן הראשי
        </a>
        <div className="app-shell">
          <header className="app-topbar">
            <div className="app-topbar-inner">
              <div className="app-topbar-row">
                <Link href="/" className="app-brand" aria-label={`${CITY.appTitle}, לדף הבית`}>
                  {logoSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoSrc} alt="" className="brand-logo" />
                  ) : null}
                  <span className="min-w-0">
                    <span className="app-brand-name">{CITY.appTitle}</span>
                    <span className="app-brand-sub">{CITY.authority}</span>
                  </span>
                </Link>
                <div className="app-topbar-menu">
                  <AIMenu staff={staff} palette={palette} viewMode={viewMode} />
                </div>
              </div>
              <TabBar staff={staff} pendingPhotos={pendingPhotos} />
            </div>
            <div className="brand-rule" aria-hidden="true" />
          </header>
          <div className="app-body">
            <main id="main" className="app-main">
              {children}
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[12px] text-ink-faint">
                <span>{BUILD_LABEL}</span>
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
