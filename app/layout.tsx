import type { Metadata } from "next";
// Art direction: Cormorant Garamond carries the illuminated-manuscript display voice,
// Alegreya + Alegreya Sans are a designed superfamily for story text and utility labels.
// All three ship real Cyrillic, so Russian no longer falls back to the OS font.
import { Alegreya, Alegreya_Sans, Cormorant_Garamond } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["cyrillic", "latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const story = Alegreya({
  variable: "--font-story",
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const ui = Alegreya_Sans({
  variable: "--font-ui",
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const title = "Летопись Тео — семейная wiki сказочного мира";
const description = "Герои, мир, хронология и мастерская продолжений авторской сказки о Тео и четырёх временах года.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const image = `${origin}/og.png`;

  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
    themeColor: "#0d1422", // matches the night ground so mobile chrome blends in
    openGraph: {
      type: "website",
      title,
      description,
      images: [{ url: image, width: 1536, height: 1024, alt: "Тео, Весемир и принц Талос" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The font variables land on <body>, and globals.css declares the --display /
  // --story / --ui role tokens on `body` for the same reason: a var() that
  // resolves nowhere invalidates every `font:` shorthand built on it.
  return (
    <html lang="ru">
      <body className={`${display.variable} ${story.variable} ${ui.variable}`}>
        {/* Paper tooth: one fixed grain plate over the whole night ground */}
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
