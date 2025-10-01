import { Link, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export default function MainScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>欢迎, {user?.username}!</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>退出登录</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.menuContainer}>
        <Link href="../fitness" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>健身记录</Text>
          </TouchableOpacity>
        </Link>

        <Link href="../profile" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>个人信息</Text>
          </TouchableOpacity>
        </Link>

        <Link href="../ai" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>AI建议</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#ff4444',
    borderRadius: 4,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  menuItem: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 2,
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 18,
    color: '#333',
  },
});