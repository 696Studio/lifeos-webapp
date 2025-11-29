"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/earn", label: "Earn" },
    { href: "/stats", label: "Statistics" },
  ];

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "radial-gradient(circle at top, #02141b 0%, #020609 60%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
        }}
      >
        {/* 🔌 Подключаем Telegram WebApp скрипт */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "420px",
            minHeight: "100vh",
            boxSizing: "border-box",
            margin: "0 auto",
            paddingTop: "90px", // пространство под меню сверху
            paddingBottom: "40px",
          }}
        >
          {/* Верхнее меню */}
          <nav
            style={{
              position: "fixed",
              left: "50%",
              top: "25px",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: "420px",
              padding: "10px 14px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                background: "rgba(5, 12, 18, 0.95)",
                borderRadius: "999px",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                padding: "4px",
                boxShadow: "0 18px 40px rgba(0, 0, 0, 0.6)",
              }}
            >
              {navItems.map((item) => {
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "10px 4px",
                      borderRadius: "999px",
                      fontSize: "13px",
                      fontWeight: 500,
                      textDecoration: "none",
                      background: active
                        ? "linear-gradient(90deg, #00e5ff, #00b3ff)"
                        : "transparent",
                      color: active ? "#020b10" : "#8b9aa1",
                      boxShadow: active
                        ? "0 0 18px rgba(0, 229, 255, 0.45)"
                        : "none",
                      transition:
                        "background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Контент страниц */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "calc(100vh - 140px)",
              padding: "0 16px",
            }}
          >
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
