import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CITY } from "@/lib/city";
import TabBar from "@/components/TabBar";
import ViewModeToggle from "@/components/ViewModeToggle";
import PaletteToggle from "@/components/PaletteToggle";
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
          href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          דילוג לתוכן הראשי
        </a>
        <div className="app-shell">
          <TabBar staff={staff} pendingPhotos={pendingPhotos} />
          <div className="app-body">
            <div className="brand-rule" aria-hidden="true" />
            <header className="app-header">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {logoSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={logoSrc} alt={CITY.authority} className="brand-logo" />
                  ) : null}
                  <div>
                    <p className="text-[17px] font-semibold text-ink">{CITY.appTitle}</p>
                    <p className="text-[13px] text-ink-faint">{CITY.authority}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PaletteToggle current={palette} />
                  <ViewModeToggle current={viewMode} />
                </div>
              </div>
            </header>
            <main id="main" className="app-main">
              {children}
              {/*
                דלת הכניסה של הצוות. קודם לכן לשונית "צוות" הופיעה רק אחרי
                ההתחברות, כלומר הדרך היחידה להגיע למסך ההתחברות הייתה להקליד
                /admin בשורת הכתובת. מי שאינו יודע זאת פשוט לא ראה שקיים
                מסך אישור תמונות. הקישור כאן שקט, בתחתית, וקיים תמיד.
              */}
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[12px] text-ink-faint">
                <span>{BUILD_LABEL}</span>
                {staff ? (
                  <form action="/api/staff/logout" method="post">
                    <button
                      type="submit"
                      className="inline-block py-1 text-[12px] text-ink-faint underline underline-offset-2"
                    >
                      יציאה מהצוות
                    </button>
                  </form>
                ) : (
                  <a
                    href="/admin"
                    className="inline-block py-1 text-[12px] text-ink-faint underline underline-offset-2"
                  >
                    כניסת צוות
                  </a>
                )}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
