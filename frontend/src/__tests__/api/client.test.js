import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the interceptor logic by importing the client and inspecting its interceptors
import client from '../../api/client'

describe('API client interceptors', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('request interceptor injects Bearer token from sessionStorage', () => {
    sessionStorage.setItem('token', 'my-test-token')
    const requestInterceptor = client.interceptors.request.handlers[0]
    const config = { headers: {} }
    const result = requestInterceptor.fulfilled(config)
    expect(result.headers.Authorization).toBe('Bearer my-test-token')
  })

  it('request interceptor skips token when not in sessionStorage', () => {
    const requestInterceptor = client.interceptors.request.handlers[0]
    const config = { headers: {} }
    const result = requestInterceptor.fulfilled(config)
    expect(result.headers.Authorization).toBeUndefined()
  })
})
