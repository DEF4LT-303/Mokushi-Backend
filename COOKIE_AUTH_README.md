# Cookie-Based JWT Authentication System

This document explains the implementation of secure, HTTP-only cookie-based JWT authentication in the Mokushi Backend.

## Overview

The authentication system has been updated to use HTTP-only cookies instead of returning JWT tokens in response bodies. This provides better security against XSS attacks and follows security best practices.

## Key Features

- **HTTP-Only Cookies**: Tokens are stored in secure, HTTP-only cookies
- **Automatic Token Refresh**: Middleware automatically refreshes expired access tokens
- **Secure Cookie Settings**: Production-ready cookie configuration
- **OAuth Integration**: Google OAuth works seamlessly with cookies
- **Backward Compatibility**: Still supports Authorization header for API clients

## Security Benefits

1. **XSS Protection**: HTTP-only cookies cannot be accessed by JavaScript
2. **CSRF Protection**: SameSite cookie attribute prevents CSRF attacks
3. **Secure Transport**: Cookies are only sent over HTTPS in production
4. **Automatic Expiry**: Tokens automatically expire and refresh

## Cookie Configuration

### Development Environment
- `secure: false` (allows HTTP)
- `sameSite: 'lax'` (allows cross-site requests)

### Production Environment
- `secure: true` (HTTPS only)
- `sameSite: 'strict'` (prevents CSRF attacks)

## API Endpoints

### Authentication Endpoints

#### POST `/api/auth/login`
- **Body**: `{ email: string, password: string }`
- **Response**: User data + cookies set automatically
- **Cookies**: `access_token` (15min), `refresh_token` (7 days)

#### POST `/api/auth/register`
- **Body**: `CreateUserDto`
- **Response**: User data + cookies set automatically
- **Cookies**: `access_token` (15min), `refresh_token` (7 days)

#### POST `/api/auth/refresh-token`
- **Body**: None (uses refresh token from cookie)
- **Response**: Success message + new cookies set
- **Cookies**: New `access_token` and `refresh_token`

#### POST `/api/auth/logout`
- **Body**: None
- **Response**: Success message
- **Action**: Clears all auth cookies and revokes refresh tokens

#### GET `/api/auth/google`
- **Action**: Initiates Google OAuth flow

#### GET `/api/auth/google/callback`
- **Action**: OAuth callback, sets cookies, redirects to frontend

#### GET `/api/auth/me`
- **Headers**: Requires valid access token (from cookie or Authorization header)
- **Response**: Current user data

#### GET `/api/auth/test-auth`
- **Purpose**: Test authentication status
- **Response**: Authentication status and user info if authenticated

## Frontend Integration

### Cookie Handling
The frontend doesn't need to manually handle JWT tokens. Cookies are automatically sent with requests.

### CORS Configuration
Ensure your frontend CORS settings include:
```javascript
credentials: 'include' // For fetch requests
withCredentials: true   // For axios requests
```

### Example Frontend Request
```javascript
// Cookies are automatically sent
fetch('/api/auth/me', {
  credentials: 'include'
})

// Or with axios
axios.get('/api/auth/me', {
  withCredentials: true
})
```

### OAuth Flow
1. User clicks "Login with Google"
2. Redirected to `/api/auth/google`
3. Google OAuth flow completes
4. User redirected to frontend with cookies set
5. Frontend can immediately make authenticated requests

## Middleware Behavior

### Automatic Token Refresh
The `AuthMiddleware` automatically:
1. Checks if access token is valid
2. If expired, attempts to refresh using refresh token
3. Sets new access token cookie
4. Continues request processing

### Request Flow
1. Request comes in with cookies
2. Middleware checks access token
3. If valid: sets `req.user` and continues
4. If expired: attempts refresh
5. If refresh successful: sets new token and continues
6. If refresh fails: clears cookies and continues

## Environment Variables

```bash
# Required
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Optional
NODE_ENV=production  # Enables secure cookie settings
FRONTEND_URL=https://yourdomain.com  # CORS origin
FRONTEND_REDIRECT_URL=https://yourdomain.com/oauth-callback
FRONTEND_ERROR_REDIRECT_URL=https://yourdomain.com/error
```

## Testing

### Test Authentication Status
```bash
GET /api/auth/test-auth
```

### Test Protected Endpoint
```bash
GET /api/auth/me
# Requires valid access token (from cookie or Authorization header)
```

## Migration from Token-Based Auth

### For API Clients
- Continue using Authorization header with Bearer token
- JWT strategy supports both cookies and Authorization header

### For Web Applications
- Update CORS settings to include `credentials: 'include'`
- Remove manual token storage and handling
- Cookies are automatically managed by the browser

## Security Considerations

1. **HTTPS Required in Production**: Cookies are only sent over HTTPS when `secure: true`
2. **SameSite Protection**: Prevents CSRF attacks in production
3. **HttpOnly**: Prevents XSS attacks from accessing tokens
4. **Automatic Expiry**: Short-lived access tokens reduce exposure
5. **Token Rotation**: Refresh tokens are rotated on each use

## Troubleshooting

### Cookies Not Set
- Check CORS configuration
- Ensure `credentials: 'include'` in frontend
- Verify cookie domain and path settings

### Authentication Fails
- Check JWT secrets in environment variables
- Verify token expiration times
- Check database connection for refresh token validation

### OAuth Issues
- Verify Google OAuth configuration
- Check redirect URLs in Google Console
- Ensure frontend redirect URLs are configured

## Best Practices

1. **Always use HTTPS in production**
2. **Set appropriate cookie expiration times**
3. **Monitor token refresh patterns**
4. **Implement proper error handling**
5. **Log authentication events for security monitoring**
6. **Regular security audits of JWT implementation**
