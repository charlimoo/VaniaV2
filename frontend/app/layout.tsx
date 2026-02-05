import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { UserProvider } from "@/components/providers/user-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConfigProvider } from "@/components/providers/config-provider";
import { Toaster } from "@/components/ui/sonner";
import { APP_CONFIG } from "@/lib/config";

const estedad = localFont({
  src: [
    { path: "./fonts/IRANSansXV.ttf", style: "normal" },
  ],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: APP_CONFIG.BRANDING.APP_NAME,
  description: APP_CONFIG.BRANDING.APP_TAGLINE,
  icons: {
    icon: APP_CONFIG.IMAGES.FAVICON,
    shortcut: APP_CONFIG.IMAGES.FAVICON,
    apple: APP_CONFIG.IMAGES.FAVICON,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${estedad.variable} antialiased`}
        style={{
          fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, var(--font-sans)',
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* ConfigProvider wraps UserProvider to ensure config is loaded before user data might need it */}
          <ConfigProvider>
            <UserProvider>
              {children}
              <Toaster dir="rtl" theme="dark" className="font-sans" />
            </UserProvider>
          </ConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}