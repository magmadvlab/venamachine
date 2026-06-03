import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "Vena Coffee Machine · Officina",
  description: "Accettazione e tracking riparazioni macchine da caffè",
  manifest: "/manifest.webmanifest",
  applicationName: "Vena Coffee Machine",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vena Coffee Machine",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b2320",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="font-sans text-coffee-900 antialiased">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
