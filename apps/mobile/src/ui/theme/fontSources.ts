import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader/400Regular';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader/600SemiBold';
import { fontFamilies } from './tokens';

export const FONT_SOURCES = {
  [fontFamilies.serifRegular]: Newsreader_400Regular,
  [fontFamilies.serifSemiBold]: Newsreader_600SemiBold,
  [fontFamilies.sansRegular]: DMSans_400Regular,
  [fontFamilies.sansMedium]: DMSans_500Medium,
  [fontFamilies.sansSemiBold]: DMSans_600SemiBold,
};
