import "./globals.css";

// Bewusst ohne next/font: die Google-Fonts würden beim Docker-Build
// Netzwerkzugriff brauchen. Die Steuerseite bringt ihre Schriften
// als System-Font-Stack selbst mit.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
