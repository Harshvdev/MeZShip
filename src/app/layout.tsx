import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "MeZShip — Spontaneous Campus 1-to-1 Random Chat",
  description:
    "A local random-chat platform for spontaneous 1-to-1 conversations with people who are currently inside selected campuses.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
