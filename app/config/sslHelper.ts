// SSL证书处理辅助函数
// 用于处理自签名证书问题


// 检查是否为开发环境
export const isDevelopment = () => {
  return __DEV__;
};

// 获取API基础URL
export const getApiBaseUrl = () => {
  // 在开发环境中，我们可以提供一些选项
  if (isDevelopment()) {
    return 'https://positivepassion.top';
  }
  // 生产环境始终使用HTTPS
  return 'https://positivepassion.top';
};

// 创建带有SSL处理的fetch选项
export const createSecureFetchOptions = (options: RequestInit = {}) => {
  const baseOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // 在开发环境中，我们可以添加一些调试信息
  if (isDevelopment()) {
    console.log('发起API请求到:', getApiBaseUrl());
  }

  return baseOptions;
};

// 安全的fetch包装器
export const secureFetch = async (url: string, options: RequestInit = {}) => {
  const fullUrl = url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`;
  const secureOptions = createSecureFetchOptions(options);

  try {
    if (isDevelopment()) {
      console.log('发起请求:', fullUrl, secureOptions);
    }

    const response = await fetch(fullUrl, secureOptions);
    
    if (isDevelopment()) {
      console.log('响应状态:', response.status, response.statusText);
    }

    return response;
  } catch (error) {
    if (isDevelopment()) {
      console.error('API请求失败:', error);
      
      // 提供SSL证书相关的错误提示
      if (error instanceof Error && (
        error.message.includes('certificate') || 
        error.message.includes('SSL') ||
        error.message.includes('network')
      )) {
        console.warn(`
          ╔══════════════════════════════════════════════════════════════╗
          ║                    SSL证书问题检测                        ║
          ╠══════════════════════════════════════════════════════════════╣
          ║ 检测到SSL证书问题，这通常是因为服务器使用自签名证书。     ║
          ║                                                            ║
          ║ 解决方案：                                                 ║
          ║ 1. 在浏览器中访问 https://positivepassion.top               ║
          ║ 2. 接受安全警告并继续访问                                 ║
          ║ 3. 返回应用重试                                           ║
          ║                                                            ║
          ║ 或者：                                                     ║
          ║ 1. 获取有效的SSL证书                                      ║
          ║ 2. 配置服务器使用有效证书                                 ║
          ╚══════════════════════════════════════════════════════════════╝
        `);
      }
    }
    
    throw error;
  }
};

// 测试API连接的函数
export const testApiConnectionWithSSL = async () => {
  try {
    const response = await secureFetch('/');
    
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