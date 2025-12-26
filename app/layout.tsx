import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // 1. 브라우저 탭에 뜨는 큰 제목
  title: "Brawl Ranked Meta",
  
  // 2. 구글/네이버 검색 시 제목 아래에 뜨는 설명글
  description: "브롤스타즈 최신 경쟁전 메타, 맵별 승률, 추천 브롤러, 카운터 정보를 한눈에 확인하세요.",
  
  // 3. (선택사항) 카톡이나 디스코드로 링크 공유할 때 뜨는 정보 (Open Graph)
  openGraph: {
    title: "Brawl Ranked Meta",
    description: "브롤스타즈 최신 경쟁전 메타, 맵별 승률, 추천 브롤러, 카운터 정보를 한눈에 확인하세요.",
    url: "https://brawlstats.xyz",
    siteName: "Brawl Meta",
    images: [
      {
        url: "/icons/logo.png", // 썸네일 이미지 (public 폴더에 있는 이미지 경로)
        width: 800,
        height: 600,
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
