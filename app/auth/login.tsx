import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from './AuthContext';

export default function LoginScreen() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, register } = useAuth();
  const router = useRouter();

  const handleAuth = async () => {
    if (!username || !password) {
      Alert.alert('错误', '请输入用户名和密码');
      return;
    }

    if (!isLoginMode && password !== confirmPassword) {
      Alert.alert('错误', '两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      let success;
      if (isLoginMode) {
        success = await login(username, password);
        if (success) {
          Alert.alert('成功', '登录成功');
          // 登录成功后重定向到主页面
          setTimeout(() => {
            router.replace('../main');
          }, 1000);
        } else {
          Alert.alert('错误', '用户名或密码错误');
        }
      } else {
        success = await register(username, password);
        if (success) {
          Alert.alert('成功', '注册成功，请登录');
          setIsLoginMode(true);
          setPassword('');
          setConfirmPassword('');
        } else {
          Alert.alert('错误', '注册失败，用户名可能已存在');
        }
      }
    } catch (error) {
      Alert.alert('错误', '无法连接到服务器');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLoginMode ? '登录' : '注册'}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="用户名"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        editable={!isLoading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="密码"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
      />
      
      {!isLoginMode && (
        <TextInput
          style={styles.input}
          placeholder="确认密码"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!isLoading}
        />
      )}
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.disabledButton]} 
        onPress={handleAuth}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? '处理中...' : (isLoginMode ? '登录' : '注册')}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => setIsLoginMode(!isLoginMode)}
        disabled={isLoading}
      >
        <Text style={styles.switchButtonText}>
          {isLoginMode ? '没有账号？去注册' : '已有账号？去登录'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  button: {
    width: '100%',
    height: 40,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    marginBottom: 15,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 10,
  },
  switchButtonText: {
    color: '#007bff',
    fontSize: 14,
  },
});