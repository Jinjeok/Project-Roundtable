import "./globals.css";

export const metadata = {
  title: "Project Round Table | Dev Console",
  description: "Cairn RPG AI Warden development console",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
