import { LoginCredentials, RegisterCredentials, AuthResponse, User } from '../types/index';

const API_BASE_URL = '/api';

export class AuthService {
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    
    // El backend devuelve el usuario directamente, no dentro de AuthResponse
    // Extraemos el token del header Authorization
    const authHeader = response.headers.get('Authorization');
    let access_token = '';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      access_token = authHeader.substring(7);
    } else {
      console.log('AuthService.login: No se encontró token en el header');
    }
    
    this.setToken(access_token);
    this.setUser(data);
    
    // Crear AuthResponse compatible
    const authResponse: AuthResponse = {
      access_token,
      user: data
    };
    
    return authResponse;
  }

  static async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    const data = await response.json();
    
    // El backend devuelve el usuario directamente, no dentro de AuthResponse
    // Extraemos el token del header Authorization
    const authHeader = response.headers.get('Authorization');
    let access_token = '';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      access_token = authHeader.substring(7);
    }
    
    this.setToken(access_token);
    this.setUser(data);
    
    // Crear AuthResponse compatible
    const authResponse: AuthResponse = {
      access_token,
      user: data
    };
    
    return authResponse;
  }

  static logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  static setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  static getToken(): string | null {
    // Primero intentar obtener el token del localStorage directo
    let token = localStorage.getItem('token');
    
    // Si no hay token en localStorage, intentar extraerlo del usuario guardado
    if (!token) {
      const user = this.getCurrentUser();
      if (user && (user as any).access_token) {
        token = (user as any).access_token;
        // Guardar el token en localStorage para futuras consultas
        if (token) {
          this.setToken(token);
        }
      }
    }
    
    return token;
  }

  static isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }

  static setUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
    // Verificar que se guardó correctamente
    const savedUser = localStorage.getItem('user');
  }

  static getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr || userStr === 'undefined' || userStr === 'null') {
        return null;
      }
      const user = JSON.parse(userStr);
      return user;
    } catch (error) {
      console.error('AuthService.getCurrentUser: Error parsing user:', error);
      return null;
    }
  }

  static getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }
}