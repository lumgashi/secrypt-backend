import * as argon2 from 'argon2';

export async function matchPassword(
  password: string | null,
  inputPassword: string,
): Promise<boolean> {
  if (!password) {
    // No password set in the database, so skip password validation
    return true;
  }
  // Compare the stored password hash with the provided password
  return argon2.verify(password, inputPassword);
}
