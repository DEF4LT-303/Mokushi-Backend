import { Response } from "express";

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  maxAge: number;
  path: string;
}

export const getCookieOptions = (isProduction?: boolean): CookieOptions => {
  const isProd =
    isProduction !== undefined
      ? isProduction
      : process.env.NODE_ENV === "production";

  // Check if running in a purely local HTTP environment without SSL
  const isLocalHttp =
    !isProd &&
    Boolean(
      process.env.FRONTEND_URL?.startsWith("http://localhost") ||
        process.env.BACKEND_URL?.startsWith("http://localhost"),
    );

  // In modern browsers, SameSite=None strictly requires Secure=true (RFC 6265bis).
  // On local HTTP, use sameSite: 'lax' and secure: false.
  // On hosted environments (VPS, staging, dev.mokushiken.com, production), use sameSite: 'none' and secure: true.
  if (isLocalHttp) {
    return {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    };
  }

  return {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 0,
    path: "/",
  };
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  isProduction: boolean,
) => {
  const baseOptions = getCookieOptions(isProduction);

  // Set access token cookie (15 minutes)
  res.cookie("access_token", accessToken, {
    ...baseOptions,
    maxAge: parseInt(process.env.COOKIE_ACCESS_MAX_AGE || "900000", 10),
  });

  // Set refresh token cookie (7 days)
  res.cookie("refresh_token", refreshToken, {
    ...baseOptions,
    maxAge: parseInt(process.env.COOKIE_REFRESH_MAX_AGE || "604800000", 10),
  });
};

export const clearAuthCookies = (res: Response, isProduction?: boolean) => {
  const prod =
    isProduction !== undefined
      ? isProduction
      : process.env.NODE_ENV === "production";
  const baseOptions = getCookieOptions(prod);
  res.clearCookie("access_token", baseOptions);
  res.clearCookie("refresh_token", baseOptions);
};
