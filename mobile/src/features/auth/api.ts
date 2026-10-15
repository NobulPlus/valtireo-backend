import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post<{ message: string }>('/auth/forgot-password', { email }),
  });
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  password: string;
  password_confirmation: string;
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => api.post<{ message: string }>('/auth/reset-password', payload),
  });
}
