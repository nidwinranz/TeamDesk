import { hash, verify } from '@node-rs/argon2';

// OWASP-recommended argon2id parameters (m=19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Pre-computed hash used to equalise timing when the email does not exist.
let dummyHash: Promise<string> | undefined;
export function dummyVerify(password: string): Promise<boolean> {
  dummyHash ??= hashPassword('timing-equaliser-password');
  return dummyHash.then((h) => verifyPassword(h, password)).then(() => false);
}
