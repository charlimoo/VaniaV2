import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { UserProvider } from "@/components/providers/user-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConfigProvider } from "@/components/providers/config-provider";
import { GlobalOnboardingPrompts } from "@/components/onboarding/GlobalOnboardingPrompts";
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
              <GlobalOnboardingPrompts />
              <Toaster dir="rtl" theme="dark" className="font-sans" />
            </UserProvider>
          </ConfigProvider>
        </ThemeProvider>
        <Script
          id="goftino-widget"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(){var i="Ab7LrL",a=window,d=document;function g(){var g=d.createElement("script"),s="https://www.goftino.com/widget/"+i,l=localStorage.getItem("goftino_"+i);g.async=!0,g.src=l?s+"?o="+l:s;d.getElementsByTagName("head")[0].appendChild(g);}"complete"===d.readyState?g():a.attachEvent?a.attachEvent("onload",g):a.addEventListener("load",g,!1);}();
            `,
          }}
        />
      </body>
    </html>
  );
}
