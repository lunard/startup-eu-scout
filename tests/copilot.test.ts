import { checkCopilotHealth, validateOpusModel, generateEuropeanSummaryCard } from '../src/main/copilot';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

import { exec, spawn } from 'child_process';

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Helper to build a mock exec callback
function mockExecSuccess(stdout: string) {
  return (_cmd: string, _opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    if (typeof _opts === 'function') {
      (_opts as typeof cb)(null, { stdout, stderr: '' });
    } else {
      cb(null, { stdout, stderr: '' });
    }
    return {} as ReturnType<typeof exec>;
  };
}

function mockExecError() {
  return (_cmd: string, _opts: unknown, cb: (err: Error | null) => void) => {
    if (typeof _opts === 'function') {
      (_opts as typeof cb)(new Error('command not found'));
    } else {
      cb(new Error('command not found'));
    }
    return {} as ReturnType<typeof exec>;
  };
}

describe('checkCopilotHealth', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when copilot --version outputs a non-empty string', async () => {
    mockExec.mockImplementationOnce(mockExecSuccess('copilot 2.1.0') as unknown as typeof exec);
    const result = await checkCopilotHealth();
    expect(result).toBe(true);
  });

  it('returns false when the CLI is not found', async () => {
    mockExec.mockImplementationOnce(mockExecError() as unknown as typeof exec);
    const result = await checkCopilotHealth();
    expect(result).toBe(false);
  });

  it('returns false when stdout is empty', async () => {
    mockExec.mockImplementationOnce(mockExecSuccess('') as unknown as typeof exec);
    const result = await checkCopilotHealth();
    expect(result).toBe(false);
  });
});

describe('validateOpusModel', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when active model output contains "opus" and "4.6"', async () => {
    mockExec.mockImplementationOnce(mockExecSuccess('Active model: opus 4.6') as unknown as typeof exec);
    const result = await validateOpusModel();
    expect(result).toBe(true);
  });

  it('returns false when active model is different', async () => {
    mockExec.mockImplementationOnce(mockExecSuccess('Active model: gpt-4') as unknown as typeof exec);
    const result = await validateOpusModel();
    expect(result).toBe(false);
  });

  it('falls back to secondary command on first failure and returns true if opus 4.6 found', async () => {
    mockExec
      .mockImplementationOnce(mockExecError() as unknown as typeof exec)
      .mockImplementationOnce(mockExecSuccess('Current model: opus-4.6') as unknown as typeof exec);
    const result = await validateOpusModel();
    expect(result).toBe(true);
  });

  it('returns false when both commands fail', async () => {
    mockExec
      .mockImplementationOnce(mockExecError() as unknown as typeof exec)
      .mockImplementationOnce(mockExecError() as unknown as typeof exec);
    const result = await validateOpusModel();
    expect(result).toBe(false);
  });
});

describe('generateEuropeanSummaryCard', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a parsed EuropeanSummaryCard when Copilot CLI outputs valid JSON', async () => {
    const mockCard = {
      companyName: 'TestCo GmbH',
      vatNumber: 'DE123456789',
      naceCodes: ['62.01'],
      missionStatement: 'We build AI tools.',
      coreTechnologies: ['AI', 'cloud'],
      targetMarkets: ['Germany', 'France'],
      keywords: ['AI', 'machine learning', 'SaaS'],
      eligibilitySummary: 'Eligible for Horizon Europe.',
    };

    const mockProc = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      stdin: { write: jest.fn(), end: jest.fn() },
      on: jest.fn(),
    };

    mockSpawn.mockReturnValueOnce(mockProc as unknown as ReturnType<typeof spawn>);

    // Simulate process emitting data and closing
    mockProc.stdout.on.mockImplementation((event: string, cb: (buf: Buffer) => void) => {
      if (event === 'data') cb(Buffer.from(JSON.stringify(mockCard)));
    });
    mockProc.stderr.on.mockImplementation(() => {});
    mockProc.on.mockImplementation((event: string, cb: (code: number) => void) => {
      if (event === 'close') cb(0);
    });

    const result = await generateEuropeanSummaryCard({ companyName: 'TestCo GmbH' });
    expect(result).not.toBeNull();
    expect(result?.companyName).toBe('TestCo GmbH');
    expect(result?.keywords).toContain('AI');
  });

  it('returns null when Copilot CLI exits with non-zero code', async () => {
    const mockProc = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      stdin: { write: jest.fn(), end: jest.fn() },
      on: jest.fn(),
    };

    mockSpawn.mockReturnValueOnce(mockProc as unknown as ReturnType<typeof spawn>);

    mockProc.stdout.on.mockImplementation(() => {});
    mockProc.stderr.on.mockImplementation(() => {});
    mockProc.on.mockImplementation((event: string, cb: (code: number) => void) => {
      if (event === 'close') cb(1);
    });

    const result = await generateEuropeanSummaryCard({});
    expect(result).toBeNull();
  });

  it('returns null when CLI output contains no JSON', async () => {
    const mockProc = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      stdin: { write: jest.fn(), end: jest.fn() },
      on: jest.fn(),
    };

    mockSpawn.mockReturnValueOnce(mockProc as unknown as ReturnType<typeof spawn>);

    mockProc.stdout.on.mockImplementation((event: string, cb: (buf: Buffer) => void) => {
      if (event === 'data') cb(Buffer.from('Sorry, I cannot help with that.'));
    });
    mockProc.stderr.on.mockImplementation(() => {});
    mockProc.on.mockImplementation((event: string, cb: (code: number) => void) => {
      if (event === 'close') cb(0);
    });

    const result = await generateEuropeanSummaryCard({});
    expect(result).toBeNull();
  });
});
