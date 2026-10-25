import { APP_NAME } from '@singalore/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '../actions';

type SearchParams = Record<string, string | string[] | undefined>;

export function readMessage(searchParams: SearchParams, key: 'error' | 'notice'): string | null
{
  const value = searchParams[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function Messages({ searchParams }: { searchParams: SearchParams })
{
  const error = readMessage(searchParams, 'error');
  const notice = readMessage(searchParams, 'notice');
  return (
    <>
      {error !== null && <p role="alert" className="message message-error">{error}</p>}
      {notice !== null && <p role="status" className="message message-notice">{notice}</p>}
    </>
  );
}

export function CmsShell({ displayName, children }: { displayName: string; children: ReactNode })
{
  return (
    <div className="cms">
      <header className="cms-header">
        <Link href="/cms" className="wordmark">{`${APP_NAME} CMS`}</Link>
        <nav className="cms-nav">
          <Link href="/cms">Landmarks</Link>
          <Link href="/cms/landmarks/new">New landmark</Link>
          <span className="muted">{displayName}</span>
          <form action={signOut}>
            <button type="submit" className="button-secondary">Sign out</button>
          </form>
        </nav>
      </header>
      <main className="cms-main">{children}</main>
    </div>
  );
}

export function StatusBadge({ status }: { status: 'draft' | 'published' })
{
  return <span className={`badge badge-${status}`}>{status === 'published' ? 'Published' : 'Draft'}</span>;
}
