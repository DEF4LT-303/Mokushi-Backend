import { Prisma } from '@prisma/client';

export const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  firstName: true,
  lastName: true,
  picture: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{
  select: typeof safeUserSelect;
}>;
