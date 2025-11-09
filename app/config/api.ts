// 生产服务器API基础URL
export const API_BASE_URL = 'https://positivepassion.top';

// 导入SSL辅助函数
import { secureFetch, testApiConnectionWithSSL } from './sslHelper';

// 调试函数，用于测试连接（使用SSL辅助函数）
export const testApiConnection = async () => {
  return await testApiConnectionWithSSL();
};

// 导出安全的fetch函数供其他模块使用
export { secureFetch };

// API端点
export const API_ENDPOINTS = {
  LOGIN: '/login',
  REGISTER: '/register',
  USER_INFO: '/users/me',
  FITNESS_RECORDS: '/fitness-records',
  CHAT: '/chat',
  CHAT_HISTORY: '/chat-history',
};