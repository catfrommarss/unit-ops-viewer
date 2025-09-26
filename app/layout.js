// app/layout.js
import './globals.css';

export const metadata = {
  title: 'Unit Operations Viewer',
  description: 'Query Hyperunit operations by address',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
