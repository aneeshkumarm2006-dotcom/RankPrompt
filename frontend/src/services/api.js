const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Token storage helpers for iOS Safari fallback
const getStoredToken = () => localStorage.getItem('authToken');
const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem('authToken', token);
  }
};
const removeStoredToken = () => localStorage.removeItem('authToken');

// Get authorization headers (for iOS Safari fallback)
const getAuthHeaders = () => {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Helper function to handle API responses
const handleResponse = async (response, saveToken = false) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  // Store token from login/register responses for iOS Safari fallback
  if (saveToken && data.token) {
    setStoredToken(data.token);
  }

  return data;
};

// Auth API calls
export const authAPI = {
  // Register new user
  register: async (userData) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(userData),
    });
    return handleResponse(response, true);
  },

  // Login user
  login: async (credentials) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });
    return handleResponse(response, true);
  },

  // Logout user
  logout: async () => {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    removeStoredToken();
    return handleResponse(response);
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    return handleResponse(response);
  },

  // Google OAuth login
  googleLogin: async (credential, referralCode = null) => {
    const body = { credential };
    if (referralCode) {
      body.referralCode = referralCode;
    }

    const response = await fetch(`${API_URL}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return handleResponse(response, true);
  },
};

// Authenticated fetch wrapper - use this for all authenticated API calls
// This ensures the Authorization header is always included for iOS Safari compatibility
export const authFetch = async (url, options = {}) => {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
};

// Export token helpers for use in other parts of the app
export { getStoredToken, setStoredToken, removeStoredToken, getAuthHeaders };
