import { UserCategory } from '@prisma/client';

const LOCAL_ID_TO_CATEGORY: Record<string, UserCategory> = {
  teacher: UserCategory.TEACHER,
  lecturer: UserCategory.LECTURER,
  tutor: UserCategory.TUTOR,
  trainer: UserCategory.TRAINER,
  employee: UserCategory.EMPLOYEE,
  student: UserCategory.STUDENT,
  personal: UserCategory.PERSONAL,
  other: UserCategory.PERSONAL,
};

/**
 * Maps Android `category` (TEACHER) and/or `roleId` (teacher) to UserCategory.
 * Returns undefined when neither is a known value (caller keeps existing).
 */
export function resolveUserCategory(
  category?: string | null,
  roleId?: string | null,
): UserCategory | undefined {
  for (const raw of [category, roleId]) {
    if (!raw?.trim()) continue;
    const trimmed = raw.trim();
    const upper = trimmed.toUpperCase().replace(/-/g, '_');
    if ((Object.values(UserCategory) as string[]).includes(upper)) {
      return upper as UserCategory;
    }
    const fromLocal = LOCAL_ID_TO_CATEGORY[trimmed.toLowerCase()];
    if (fromLocal) return fromLocal;
  }
  return undefined;
}
