import { Response } from "express";

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  maxAge: number;
  path: string;
}

export const getCookieOptions = (isProduction: boolean): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: "none",
  maxAge: 0,
  path: "/",
});

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
