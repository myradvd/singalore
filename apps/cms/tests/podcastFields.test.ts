import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PodcastFields } from '@/app/cms/_components/PodcastFields';
import type { PodcastRecord } from '@/server/contentRepository';

// Renders the podcast form fields to HTML for one podcast state.
function renderPodcastFields(podcast: PodcastRecord | null)
{
  return renderToStaticMarkup(createElement(PodcastFields, { landmarkId: 'landmark-1', podcast }));
}

describe('PodcastFields upload size hint', () =>
{
  const uploadHint = 'Hosted on Vercel, uploads are limited to about 4.5 MB. Run locally or self hosted, the CMS accepts up to 50 MB.';

  it('shows both limits on a new podcast form', () =>
  {
    expect(renderPodcastFields(null)).toContain(uploadHint);
  });

  it('shows both limits on a saved podcast that has no audio yet', () =>
  {
    expect(renderPodcastFields({ audio_path: null } as PodcastRecord)).toContain(uploadHint);
  });

  it('shows both limits when replacing existing audio', () =>
  {
    expect(renderPodcastFields({ audio_path: 'podcasts/existing.m4a' } as PodcastRecord)).toContain(uploadHint);
  });

  it('places the hint directly under the file input', () =>
  {
    const markup = renderPodcastFields(null);
    expect(markup.indexOf('name="audio"')).toBeLessThan(markup.indexOf(uploadHint));
    expect(markup.indexOf(uploadHint)).toBeLessThan(markup.indexOf('name="transcript"'));
  });
});
