# Frontend Integration Examples

This document provides practical examples of how to integrate with the new cookie-based authentication system in your frontend application.

## Basic Setup

### 1. Configure CORS for Cookies

```javascript
// For fetch API
fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include', // This is crucial for cookies
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password })
})

// For axios
import axios from 'axios';

axios.defaults.withCredentials = true;

// Or per request
axios.post('/api/auth/login', { email, password }, {
  withCredentials: true
})
```

## Authentication Functions

### 1. Login

```javascript
const login = async (email, password) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      const data = await response.json();
      // Cookies are automatically set by the browser
      // No need to store tokens manually
      return { success: true, user: data.user };
    } else {
      const error = await response.json();
      return { success: false, error: error.message };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};
```

### 2. Register

```javascript
const register = async (userData) => {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, user: data.user };
    } else {
      const error = await response.json();
      return { success: false, error: error.message };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};
```

### 3. Logout

```javascript
const logout = async () => {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      // Cookies are automatically cleared by the server
      return { success: true };
    } else {
      const error = await response.json();
      return { success: false, error: error.message };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};
```

### 4. Get Current User

```javascript
const getCurrentUser = async () => {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });

    if (response.ok) {
      const user = await response.json();
      return { success: true, user };
    } else if (response.status === 401) {
      return { success: false, authenticated: false };
    } else {
      const error = await response.json();
      return { success: false, error: error.message };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
};
```

### 5. Test Authentication Status

```javascript
const checkAuthStatus = async () => {
  try {
    const response = await fetch('/api/auth/test-auth', {
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      return { authenticated: false };
    }
  } catch (error) {
    return { authenticated: false, error: 'Network error' };
  }
};
```

## React Hook Example

```javascript
import { useState, useEffect, useCallback } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await loginUser(email, password);
      
      if (result.success) {
        setUser(result.user);
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError('An unexpected error occurred');
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const result = await logoutUser();
      if (result.success) {
        setUser(null);
        return { success: true };
      }
    } catch (err) {
      // Even if logout fails, clear local state
      setUser(null);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCurrentUser();
      
      if (result.success) {
        setUser(result.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    user,
    loading,
    error,
    login,
    logout,
    checkAuth,
    isAuthenticated: !!user,
  };
};
```

## Protected Route Component

```javascript
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
```

## OAuth Integration

### 1. Google OAuth Button

```javascript
const handleGoogleLogin = () => {
  // Redirect to backend OAuth endpoint
  window.location.href = '/api/auth/google';
};
```

### 2. OAuth Callback Handler

```javascript
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  useEffect(() => {
    const success = searchParams.get('success');
    
    if (success === 'true') {
      // OAuth was successful, cookies are set
      // Redirect to dashboard or intended page
      navigate('/dashboard');
    } else {
      // OAuth failed, redirect to error page
      navigate('/error');
    }
  }, [searchParams, navigate]);

  return <div>Processing OAuth callback...</div>;
};
```

## Error Handling

```javascript
const handleAuthError = (error) => {
  if (error.status === 401) {
    // Unauthorized - redirect to login
    navigate('/login');
  } else if (error.status === 403) {
    // Forbidden - show access denied
    setError('Access denied');
  } else {
    // Other errors
    setError('An error occurred');
  }
};
```

## Axios Interceptor Example

```javascript
import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any request headers if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, try to refresh
      try {
        await api.post('/auth/refresh-token');
        // Retry original request
        return api.request(error.config);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

## Testing

### 1. Check if Cookies are Set

```javascript
// In browser console
console.log(document.cookie);

// Should show something like:
// access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Test Authentication

```javascript
// Test endpoint
fetch('/api/auth/test-auth', { credentials: 'include' })
  .then(response => response.json())
  .then(data => console.log(data));
```

## Common Issues and Solutions

### 1. Cookies Not Being Sent

**Problem**: Cookies are not included in requests
**Solution**: Ensure `credentials: 'include'` is set

### 2. CORS Errors

**Problem**: Browser blocks requests due to CORS
**Solution**: Backend must have proper CORS configuration with `credentials: true`

### 3. Authentication Fails After Page Reload

**Problem**: User appears logged out after refresh
**Solution**: Check if cookies are properly set and not expired

### 4. OAuth Redirect Issues

**Problem**: OAuth callback doesn't work
**Solution**: Verify redirect URLs in Google Console and backend environment variables
