import socket
import sys

def test_server_connection(host, port):
    """
    测试连接到指定服务器的指定端口
    
    Args:
        host (str): 服务器IP地址或域名
        port (int): 端口号
    
    Returns:
        bool: 连接成功返回True，失败返回False
    """
    try:
        # 创建socket对象
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        # 设置超时时间为5秒
        sock.settimeout(5)
        
        print(f"正在尝试连接到 {host}:{port}...")
        
        # 尝试连接
        result = sock.connect_ex((host, port))
        
        if result == 0:
            print(f"✅ 成功连接到 {host}:{port}")
            sock.close()
            return True
        else:
            print(f"❌ 无法连接到 {host}:{port}")
            print(f"错误代码: {result}")
            sock.close()
            return False
            
    except socket.timeout:
        print(f"❌ 连接超时: 无法在指定时间内连接到 {host}:{port}")
        return False
    except socket.gaierror:
        print(f"❌ 主机名解析失败: 无法找到主机 {host}")
        return False
    except Exception as e:
        print(f"❌ 连接时发生错误: {str(e)}")
        return False

def main():
    # 服务器配置
    host = "42.192.2.40"
    port = 8000
    
    print("=" * 50)
    print("服务器连接测试工具")
    print("=" * 50)
    
    # 测试连接
    success = test_server_connection(host, port)
    
    print("=" * 50)
    if success:
        print("测试结果: 连接成功 ✓")
        sys.exit(0)
    else:
        print("测试结果: 连接失败 ✗")
        sys.exit(1)

if __name__ == "__main__":
    main()