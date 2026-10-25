import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Singalore CMS',
  description: 'Content management for the Singalore heritage walking tour app.',
};

export default function RootLayout({ children }: LayoutProps<'/'>)
{
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
