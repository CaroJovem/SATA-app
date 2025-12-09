// Hook de autenticação: acessa o AuthContext
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContextBase';

export function useAuth() {
  return useContext(AuthContext);
}
