import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://civilscope-cr.vercel.app";
const siteTitle = "Civilscope CR | Análisis territorial público";
const siteDescription =
  "Plataforma pública y gratuita de análisis integrado de terreno, clima, energía y sismicidad para Costa Rica.";
const socialImageAlt =
  "Civilscope CR, plataforma pública de análisis territorial para Costa Rica";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_CR",
    url: "/",
    siteName: "Civilscope CR",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/preview.png",
        width: 1342,
        height: 599,
        alt: socialImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/preview.png",
        alt: socialImageAlt,
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
