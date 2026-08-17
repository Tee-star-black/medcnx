import { validateEnvironment } from './validate-environment';

const validEnvironment = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/medcnx',
  FRONTEND_URL: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'access-secret-that-is-longer-than-32-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-that-is-longer-than-32-characters',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  PAYROLL_OTP_SECRET: 'payroll-secret-that-is-longer-than-32-characters',
  PORT: '4000',
};

describe('validateEnvironment', () => {
  it('normalises a valid port', () => {
    expect(validateEnvironment(validEnvironment).PORT).toBe(4000);
  });

  it('rejects placeholder security secrets', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: 'change_me',
      }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it('rejects malformed JWT durations', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_EXPIRES_IN: 'fifteen minutes',
      }),
    ).toThrow('JWT expiry values');
  });

  it('rejects non-web frontend origins', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        FRONTEND_URL: 'file:///tmp/medcnx',
      }),
    ).toThrow('unsupported URL protocol');
  });
});
