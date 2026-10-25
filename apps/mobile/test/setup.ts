import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

process.env.EXPO_PUBLIC_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.singalore.test';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.requireActual<{ setUpTests: () => void }>('react-native-reanimated').setUpTests();
jest.requireActual('react-native-gesture-handler/jestSetup');
