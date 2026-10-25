import { ESLint } from 'eslint';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const eslint = new ESLint({ cwd: root });

const cases = [
  { file: 'apps/mobile/src/modules/audio/__probe__.ts', code: "import { x } from '@/modules/location/LocationEngine';\nexport const y = x;\n", expectError: true, reason: 'audio must not import location' },
  { file: 'apps/mobile/src/modules/location/__probe__.ts', code: "import { x } from '@/modules/audio/AudioEngine';\nexport const y = x;\n", expectError: true, reason: 'location must not import audio' },
  { file: 'apps/mobile/src/modules/geofence/__probe__.ts', code: "import { x } from '@/modules/audio/AudioEngine';\nexport const y = x;\n", expectError: true, reason: 'geofence must not import audio' },
  { file: 'apps/mobile/src/modules/catalog/__probe__.ts', code: "import { x } from '@/ui/copy';\nexport const y = x;\n", expectError: true, reason: 'modules must not import ui' },
  { file: 'apps/mobile/src/modules/catalog/__probe__.ts', code: "import { x } from '@/modules/flow/flowReducer';\nexport const y = x;\n", expectError: true, reason: 'modules talk through core only' },
  { file: 'apps/mobile/src/core/__probe__.ts', code: "import { x } from '@/modules/catalog/types';\nexport const y = x;\n", expectError: true, reason: 'core imports nothing above it' },
  { file: 'apps/mobile/src/modules/catalog/__probe__.ts', code: "import { x } from '@/core/events';\nimport { z } from '@/modules/catalog/types';\nexport const y = [x, z];\n", expectError: false, reason: 'modules may import core and themselves' },
  { file: 'apps/mobile/src/ui/__probe__.ts', code: "import { x } from '@/modules/flow/flowReducer';\nexport const y = x;\n", expectError: false, reason: 'ui may import modules' },
];

let failures = 0;
for (const testCase of cases)
{
  const [result] = await eslint.lintText(testCase.code, { filePath: path.join(root, testCase.file) });
  const boundaryErrors = (result?.messages ?? []).filter((message) => message.ruleId === 'no-restricted-imports');
  const passed = testCase.expectError ? boundaryErrors.length > 0 : boundaryErrors.length === 0;
  console.log(`${passed ? 'ok  ' : 'FAIL'} ${testCase.reason}`);
  if (!passed)
  {
    failures += 1;
  }
}
if (failures > 0)
{
  console.error(`${failures} module boundary checks failed`);
  process.exit(1);
}
console.log('Module boundary rules are enforced (NFR 7.2).');
