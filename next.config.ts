import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // המפה קוראת את שכבת הרחובות מ-data/ בזמן ריצה. בלי זה הקובץ לא נכלל בפונקציה ב-Vercel.
  outputFileTracingIncludes: { "/map": ["./data/streets.geojson", "./data/bike-paths.geojson"] },
};

export default nextConfig;
