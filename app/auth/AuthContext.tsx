import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  username: string;
  birthDate?: string;
  height?: number;
  weight?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userInfo: { birthDate?: string; height?: number; weight?: number }) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化时检查本地存储的认证信息
  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('加载认证数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthData();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        
        // 获取用户信息
        const userResponse = await fetch('http://localhost:8000/users/me', {
          headers: {
            'Authorization': `Bearer ${data.access_token}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          const userInfo: User = {
            id: userData.id,
            username: userData.username,
            birthDate: userData.birth_date,
            height: userData.height,
            weight: userData.weight,
          };
          
          setUser(userInfo);
          
          // 保存到本地存储
          await AsyncStorage.setItem('token', data.access_token);
          await AsyncStorage.setItem('user', JSON.stringify(userInfo));
          
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('登录失败:', error);
      return false;
    }
  };

  const register = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      return response.ok;
    } catch (error) {
      console.error('注册失败:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    AsyncStorage.removeItem('token');
    AsyncStorage.removeItem('user');
  };

  const updateUser = async (userInfo: { birthDate?: string; height?: number; weight?: number }): Promise<boolean> => {
    if (!token || !user) return false;

    try {
      const response = await fetch('http://localhost:8000/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          birth_date: userInfo.birthDate,
          height: userInfo.height,
          weight: userInfo.weight,
        }),
      });

      if (response.ok) {
        const updatedUser = {
          ...user,
          birthDate: userInfo.birthDate,
          height: userInfo.height,
          weight: userInfo.weight,
        };
        
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新用户信息失败:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};