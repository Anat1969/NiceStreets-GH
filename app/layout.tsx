import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CITY } from "@/lib/city";
import TabBar from "@/components/TabBar";
import { isStaff } from "@/lib/session";

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
  const staff = await isStaff();
  return (
    <html lang="he" dir="rtl">
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
        <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-paper">
          <header className="border-b border-line bg-surface px-4 py-3">
            <p className="text-[17px] font-semibold text-ink">{CITY.appTitle}</p>
            <p className="text-[13px] text-ink-faint">{CITY.authority}</p>
          </header>
          <main id="main" className="flex-1 px-4 pb-28 pt-4">
            {children}
          </main>
          <TabBar staff={staff} />
        </div>
      </body>
    </html>
  );
}
