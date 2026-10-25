import { APP_NAME } from '@singalore/shared';
import { signIn } from '../actions';
import { Messages } from '../_components/CmsChrome';

export default async function LoginPage({ searchParams }: PageProps<'/cms/login'>)
{
  return (
    <main className="cms-login">
      <h1 className="wordmark">{`${APP_NAME} CMS`}</h1>
      <p className="muted">Sign in with your content manager account.</p>
      <Messages searchParams={await searchParams} />
      <form action={signIn} className="form">
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" className="button-primary">Sign in</button>
      </form>
    </main>
  );
}
