'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { analyseAudio, AudioRejectedError, type AudioAnalysis } from '@/server/audioAnalysis';
import { isContentManager, NOT_A_MANAGER_MESSAGE, requireManager, supabaseForRequest } from '@/server/auth';
import { firstIssue, formText, LandmarkForm, PodcastForm } from '@/server/contentForms';
import { ContentError } from '@/server/contentRepository';

const Credentials = z.object({ email: z.email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') });
const StatusChoice = z.enum(['draft', 'published']);

function withMessage(path: string, key: 'error' | 'notice', message: string): string
{
  return `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(message)}`;
}

function failureMessage(error: unknown): string
{
  if (error instanceof ContentError || error instanceof AudioRejectedError)
  {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export async function signIn(formData: FormData): Promise<void>
{
  const parsed = Credentials.safeParse(formText(formData));
  if (!parsed.success)
  {
    redirect(withMessage('/cms/login', 'error', firstIssue(parsed.error)));
  }
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error !== null || data.user === null)
  {
    redirect(withMessage('/cms/login', 'error', 'Email or password is incorrect.'));
  }
  if (!(await isContentManager(data.user.id)))
  {
    await supabase.auth.signOut();
    redirect(withMessage('/cms/login', 'error', NOT_A_MANAGER_MESSAGE));
  }
  redirect('/cms');
}

export async function signOut(): Promise<void>
{
  const supabase = await supabaseForRequest();
  await supabase.auth.signOut();
  redirect('/cms/login');
}

export async function saveLandmark(landmarkId: string | null, formData: FormData): Promise<void>
{
  const manager = await requireManager();
  const back = landmarkId === null ? '/cms/landmarks/new' : `/cms/landmarks/${landmarkId}`;
  const parsed = LandmarkForm.safeParse(formText(formData));
  if (!parsed.success)
  {
    redirect(withMessage(back, 'error', firstIssue(parsed.error)));
  }
  let savedId = landmarkId;
  try
  {
    if (landmarkId === null)
    {
      savedId = await manager.content.createLandmark(parsed.data);
    }
    else
    {
      await manager.content.updateLandmark(landmarkId, parsed.data);
    }
  }
  catch (error)
  {
    redirect(withMessage(back, 'error', failureMessage(error)));
  }
  redirect(withMessage(`/cms/landmarks/${savedId}`, 'notice', 'Landmark saved.'));
}

export async function setLandmarkStatus(landmarkId: string, status: string): Promise<void>
{
  const manager = await requireManager();
  const back = `/cms/landmarks/${landmarkId}`;
  const choice = StatusChoice.parse(status);
  try
  {
    await manager.content.setLandmarkStatus(landmarkId, choice);
  }
  catch (error)
  {
    redirect(withMessage(back, 'error', failureMessage(error)));
  }
  redirect(withMessage(back, 'notice', choice === 'published' ? 'Landmark published.' : 'Landmark moved back to draft.'));
}

async function readAudio(formData: FormData): Promise<{ bytes: Uint8Array; mimeType: string; analysis: AudioAnalysis } | null>
{
  const file = formData.get('audio');
  if (!(file instanceof File) || file.size === 0)
  {
    return null;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, mimeType: file.type, analysis: await analyseAudio(bytes, file.type) };
}

export async function savePodcast(podcastId: string | null, formData: FormData): Promise<void>
{
  const manager = await requireManager();
  const fields = formText(formData);
  const back = podcastId === null ? `/cms/podcasts/new?landmarkId=${encodeURIComponent(fields.landmarkId ?? '')}` : `/cms/podcasts/${podcastId}`;
  const parsed = PodcastForm.safeParse(fields);
  if (!parsed.success)
  {
    redirect(withMessage(back, 'error', firstIssue(parsed.error)));
  }
  let savedId = podcastId;
  try
  {
    const audio = await readAudio(formData);
    if (podcastId === null)
    {
      savedId = await manager.content.createPodcast(parsed.data, audio);
    }
    else
    {
      await manager.content.updatePodcast(podcastId, parsed.data, audio);
    }
  }
  catch (error)
  {
    redirect(withMessage(back, 'error', failureMessage(error)));
  }
  redirect(withMessage(`/cms/podcasts/${savedId}`, 'notice', 'Podcast saved.'));
}

export async function setPodcastStatus(podcastId: string, status: string): Promise<void>
{
  const manager = await requireManager();
  const back = `/cms/podcasts/${podcastId}`;
  const choice = StatusChoice.parse(status);
  try
  {
    await manager.content.setPodcastStatus(podcastId, choice);
  }
  catch (error)
  {
    redirect(withMessage(back, 'error', failureMessage(error)));
  }
  redirect(withMessage(back, 'notice', choice === 'published' ? 'Podcast published.' : 'Podcast moved back to draft.'));
}
