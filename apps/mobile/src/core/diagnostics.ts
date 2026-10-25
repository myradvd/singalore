export type DiagnosticsLevel = 'info' | 'warn' | 'error';

export interface DiagnosticsRecorder
{
  record(level: DiagnosticsLevel, code: string, detail?: string): Promise<void>;
}

export const silentDiagnostics: DiagnosticsRecorder = {
  record: async () =>
  {
  },
};
