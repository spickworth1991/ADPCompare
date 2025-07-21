
import "./globals.css";

export const metadata = {
  title: "ADP Comparator",
  description: "Compare ADP between Sleeper leagues",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
