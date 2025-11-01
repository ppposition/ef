import Constants from 'expo-constants';

// 获取本地IP地址
const getLocalIpAddress = () => {
  // 在开发环境中，使用你的计算机的本地IP地址
  // 你可以通过在终端运行 `ip addr` 或 `ifconfig` 来获取
  // 这里使用常见的本地IP地址范围
  return '172.30.18.147'; // 实际的本地IP地址
};

// 根据环境确定API基础URL
const getApiBaseUrl = () => {
  if (__DEV__) {
    // 开发环境
    if (Constants.platform?.web) {
      // Web环境使用localhost
      return 'http://localhost:8000';
    } else {
      // 移动设备/模拟器使用本地IP地址
      const baseUrl = `http://${getLocalIpAddress()}:8000`;
      console.log('API Base URL:', baseUrl);
      return baseUrl;
    }
  } else {
    // 生产环境应该使用实际的API服务器地址
    return 'https://your-production-api.com';
  }
};

export const API_BASE_URL = getApiBaseUrl();

// 调试函数，用于测试连接
export const testApiConnection = async () => {
  try {
    console.log('测试API连接:', API_BASE_URL);
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('API连接成功:', data);
      return true;
    } else {
      console.error('API连接失败:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('API连接错误:', error);
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