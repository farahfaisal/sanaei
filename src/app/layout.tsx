import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'صنايعي — نبني ثقة، ونصنع فرق',
  description: 'منصة صنايعي تربطك بأفضل الحرفيين المحليين الموثوقين لجميع خدمات المنزل بسرعة وأمان.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            background: #1a1a2e;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px 0;
          }
          .iphone-frame {
            position: relative;
            width: 393px;
            height: 852px;
            background: #000;
            border-radius: 55px;
            box-shadow:
              0 0 0 2px #1a1a1a,
              0 0 0 6px #2d2d2d,
              0 0 0 8px #1a1a1a,
              0 30px 80px rgba(0,0,0,0.8),
              inset 0 0 0 2px #3a3a3a;
            overflow: hidden;
            flex-shrink: 0;
          }
          .iphone-frame::before {
            content: '';
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 126px;
            height: 37px;
            background: #000;
            border-radius: 0 0 20px 20px;
            z-index: 100;
          }
          .iphone-frame::after {
            content: '';
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            width: 12px;
            height: 12px;
            background: #1a1a1a;
            border-radius: 50%;
            z-index: 101;
            box-shadow: -30px 0 0 #1a1a1a;
          }
          .iphone-screen {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 55px;
            overflow: hidden;
            background: #fff;
          }
          .iphone-screen > * {
            width: 100%;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
          }
          /* Side buttons */
          .iphone-btn-left {
            position: absolute;
            left: -10px;
            top: 120px;
            width: 4px;
            height: 32px;
            background: #2d2d2d;
            border-radius: 2px 0 0 2px;
            box-shadow: 0 50px 0 #2d2d2d, 0 100px 0 #2d2d2d;
          }
          .iphone-btn-right {
            position: absolute;
            right: -10px;
            top: 160px;
            width: 4px;
            height: 70px;
            background: #2d2d2d;
            border-radius: 0 2px 2px 0;
          }
          /* Prevent zoom on inputs */
          input, select, textarea {
            font-size: 16px !important;
          }
        ` }} />
      
      <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fsanaei1489back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20" />
      <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.3" /></head>
      <body style={{ fontFamily: "'Cairo', sans-serif" }}>
        <ThemeProvider>
          <AuthProvider>
            <div className="iphone-frame">
              <div className="iphone-btn-left" />
              <div className="iphone-btn-right" />
              <div className="iphone-screen">
                {children}
              </div>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}