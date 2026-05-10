import { create } from 'zustand';
import { api } from '../lib/axios';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/authenticate', { email, password });
      const { token, name, role, photo, id } = response.data;
      
      const userData = { id, name, email, role, photo };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      set({
        user: userData,
        token,
        isAuthenticated: true,
        isLoading: false
      });
      
      return true;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Correo o contraseña incorrectos', 
        isLoading: false 
      });
      return false;
    }
  },

  register: async (name, email, password, role = 'ROLE_GERENTE') => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      const { token, photo, id } = response.data;
      
      const userData = { id, name, email, role, photo };
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      set({
        user: userData,
        token,
        isAuthenticated: true,
        isLoading: false
      });
      
      return true;
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'No se pudo crear la cuenta. Inténtalo de nuevo.', 
        isLoading: false 
      });
      return false;
    }
  },

  updateProfile: async (newData) => {
    try {
      const response = await api.put('/users/profile', {
        name: newData.name,
        email: newData.email,
        photo: newData.photo
      });
      
      const { name, email, role, photo, id } = response.data;
      
      const updatedUser = { id, name, email, role, photo };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return true;
    } catch (error) {
      console.error("Error updating profile", error);
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  }
}));
