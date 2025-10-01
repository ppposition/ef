import { Link, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from './auth/AuthContext';

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 如果用户已登录，重定向到主页面
    if (user && !isLoading) {
      router.replace('/main');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>健身助手</Text>
      <Text style={styles.subtitle}>记录您的健身旅程，获取专业建议</Text>
      
      <Link href="/auth/login" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>开始使用</Text>
        </TouchableOpacity>
      </Link>
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
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 30,
    color: '#666',
    textAlign: 'center',
  },
  button: {
    width: '80%',
    height: 50,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
