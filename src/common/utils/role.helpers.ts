import { Role } from '@prisma/client';

export const isAdmin = (role: Role): boolean => {
  return role === 'ADMIN';
};

export const isUser = (role: Role): boolean => {
  return role === 'USER';
};

export const hasRole = (userRole: Role, requiredRole: Role): boolean => {
  if (requiredRole === 'ADMIN') {
    return userRole === 'ADMIN';
  }
  return true;
};
