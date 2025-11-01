// 测试环境API基础URL
export const API_BASE_URL = 'http://localhost:8000';

// 调试函数，用于测试连接
export const testApiConnection = async () => {
  try {
    console.log('测试API连接到本地服务器:', API_BASE_URL);
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('本地服务器API连接成功:', data);
      return true;
    } else {
      console.error('本地服务器API连接失败:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('本地服务器API连接错误:', error);
    return false;
  }
};

// API端点
export const API_ENDPOINTS = {
  LOGIN: '/login',
  REGISTER: '/register',
  USER_INFO: '/users/me',
  FITNESS_RECORDS: '/fitness-records',
  CHAT: '/chat',
  CHAT_HISTORY: '/chat-history',
};