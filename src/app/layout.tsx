import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "MeZShip — Spontaneous Campus 1-to-1 Random Chat",
  description:
    "A local random-chat platform for spontaneous 1-to-1 conversations with people who are currently inside selected campuses.",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
  themeColor: "#090a0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="antialiased h-full w-full overflow-hidden flex flex-col bg-[#090a0f] text-gray-100">
        {children}
      </body>
    </html>
  );
}
