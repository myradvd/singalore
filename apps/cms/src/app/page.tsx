import Link from 'next/link';
import { APP_NAME } from '@singalore/shared';

export default function HomePage()
{
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 16px' }}>
      <h1 className="wordmark">{APP_NAME}</h1>
      <p>Content management and API for the Singalore heritage walking tour app.</p>
      <ul>
        <li><a href="/api/v1/health">API health</a></li>
        <li><a href="/api/v1/catalog">Published catalog</a></li>
        <li><Link href="/cms">Content management (sign in)</Link></li>
      </ul>
    </main>
  );
}
