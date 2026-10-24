import type { Metadata, Viewport } from "next";
import "./globals.css";


const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://naija-hustle-web.vercel.app";
const DESC = "Sell to stopped cars at a Lagos red light, grab power-ups and block your rivals. #PlayNaijaHustle";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  openGraph: { title: "Naija Hustle", description: DESC, siteName: "Naija Hustle", type: "website", images: [{ url: "/images/promo.png", width: 1200, height: 630, alt: "Naija Hustle" }] },
  twitter: { card: "summary_large_image", title: "Naija Hustle", description: DESC, images: ["/images/promo.png"] },
  title: "Naija Hustle: Start from nothing, Build your Empire",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7b500" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
