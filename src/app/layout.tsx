import type { Metadata } from "next";
import { ThemeProvider } from "../components/ui/theme";
import "./globals.css";
export const metadata: Metadata = {
  title: "MindMora — Design system",
  description:
    "The shared design language for your local-first knowledge workspace.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
