import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FONT_SOURCES } from './fontSources';

describe('font sources', () =>
{
  it('preload the icon font with the text fonts so icons never render blank', () =>
  {
    for (const family of Object.keys(MaterialCommunityIcons.font))
    {
      expect(FONT_SOURCES).toHaveProperty([family]);
    }
    expect(Object.keys(MaterialCommunityIcons.font).length).toBeGreaterThan(0);
  });
});
