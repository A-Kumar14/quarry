const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('quarry_token') || process.env.REACT_APP_DEV_TOKEN;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Optional: handle unauthorized globally (e.g., clear token)
    // localStorage.removeItem('quarry_token');
  }

  return response;
}
