export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  apiMocking: process.env.NEXT_PUBLIC_API_MOCKING === "true",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  isDev: process.env.NODE_ENV === "development",
} as const;
