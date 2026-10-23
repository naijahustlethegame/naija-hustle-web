import type { Metadata, Viewport } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Naija Hustle: Start from nothing, Build your Empire",
  description: "Sell to stopped cars at a Lagos red light. Open your stand and sell to other players, Do you have what it takes to survive the Naija Hustle?.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7b500" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
