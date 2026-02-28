import client from './client'

export function login(username, password) {
  return client.post('/auth/login', { username, password })
}

export function register(username, email, password) {
  return client.post('/auth/register', { username, email, password })
}

export function getMe() {
  return client.get('/auth/me')
}
