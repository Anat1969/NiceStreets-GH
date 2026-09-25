import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CITY } from "@/lib/city";
import TabBar from "@/components/TabBar";
import ViewModeToggle from "@/components/ViewModeToggle";
import { getViewMode, isStaff } from "@/lib/session";
import { getStore } from "@/lib/store";

export const metadata: Metadata = {
  title: CITY.appTitle,
  description: CITY.tagline,
  manifest: "/manifest.webmanifest",
  applicationName: CITY.appShortTitle,
};

export const viewport: Viewport = {
  themeColor: "#1f6f5c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [staff, viewMode] = await Promise.all([isStaff(), getViewMode()]);
  // Read the queue only for staff; the public pages must not pay for it.
  const pendingPhotos = staff
    ? await getStore()
        .listPhotos({ status: "pending" })
        .then((rows) => rows.length)
        .catch(() => 0)
    : 0;

  return (
    <html lang="he" dir="rtl" data-view={viewMode}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
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
            <header className="app-header">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[17px] font-semibold text-ink">{CITY.appTitle}</p>
                  <p className="text-[13px] text-ink-faint">{CITY.authority}</p>
                </div>
                <ViewModeToggle current={viewMode} />
              </div>
            </header>
            <main id="main" className="app-main">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
