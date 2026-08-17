const DURATION_PATTERN = /^\d+(s|m|h|d)$/;

export function validateEnvironment(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const config = { ...raw };
  const required = [
    'DATABASE_URL',
    'FRONTEND_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_ACCESS_EXPIRES_IN',
    'JWT_REFRESH_EXPIRES_IN',
    'PAYROLL_OTP_SECRET',
  ];

  for (const key of required) {
    if (!stringValue(config[key])) {
      throw new Error(`${key} is required.`);
    }
  }

  for (const key of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'PAYROLL_OTP_SECRET',
  ]) {
    const value = stringValue(config[key]);
    if (
      value.length < 32 ||
      /change_me|replace_me|replace_with/i.test(value)
    ) {
      throw new Error(
        `${key} must be a unique secret containing at least 32 characters.`,
      );
    }
  }

  if (
    !DURATION_PATTERN.test(stringValue(config.JWT_ACCESS_EXPIRES_IN)) ||
    !DURATION_PATTERN.test(stringValue(config.JWT_REFRESH_EXPIRES_IN))
  ) {
    throw new Error(
      'JWT expiry values must use a duration such as 15m, 12h or 7d.',
    );
  }

  const port = Number(config.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  config.PORT = port;

  for (const key of ['FRONTEND_URL', 'FRONTEND_URLS']) {
    const value = stringValue(config[key]);
    if (!value) continue;
    for (const candidate of value.split(',').map((item) => item.trim())) {
      const url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`${key} contains an unsupported URL protocol.`);
      }
    }
  }

  return config;
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
