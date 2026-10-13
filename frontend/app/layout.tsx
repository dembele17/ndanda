import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "うちのくるま | 家族の車カレンダー",
  description: "誰が、いつ、何のために。家族で車の予定を共有するカレンダー。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
