import type { Metadata } from "next";
import { Ubuntu } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { UIProvider } from "@/components/ui/feedback";

// Ubuntu is a static (non-variable) family, so an explicit weight list is
// required. These mirror the weights the original site pulled from Google Fonts.
const ubuntu = Ubuntu({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-ubuntu",
});

export const metadata: Metadata = {
  title: {
    default: "ALUG@UCI VPS Services",
    template: "%s - ALUG@UCI VPS Services",
  },
  description: "Manage your ALUG@UCI VPS container.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ubuntu.variable} h-full antialiased`}>
      <body className="min-h-full">
        <UIProvider>
          <SiteHeader />
          <main>{children}</main>
        </UIProvider>
      </body>
    </html>
  );
}
