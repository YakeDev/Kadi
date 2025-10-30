import { api } from './api.js'

export const changePassword = async ({ currentPassword, newPassword }) => {
  const { data } = await api.post('/auth/password/change', {
    currentPassword,
    newPassword
  })
  return data
}
