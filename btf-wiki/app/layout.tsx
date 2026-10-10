import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';

export const metadata: Metadata = {
  title: {
    template: '%s | BTF Wiki',
    default: 'BTF Wiki',
  },
  description: 'Документация Back To Future',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
