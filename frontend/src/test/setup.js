import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('VITE_SUPABASE_LOGO_BUCKET', 'logos')
afterEach(() => { cleanup() })
