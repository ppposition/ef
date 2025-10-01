import { useState } from "react";
import { Text, View, TextInput, Button, StyleSheet, Alert, TouchableOpacity } from "react-native";

export default function Index() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState("");

  const handleAuth = async () => {
    if (!username || !password) {
      Alert.alert("错误", "请输入用户名和密码");
      return;
    }

    if (!isLoginMode && password !== confirmPassword) {
      Alert.alert("错误", "两次输入的密码不一致");
      return;
    }

    try {
      const url = isLoginMode
        ? "http://localhost:8000/login"
        : "http://localhost:8000/register";
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert("成功", data.message);
        setIsLoggedIn(true);
        setCurrentUser(username);
      } else {
        Alert.alert("错误", data.detail || "操作失败");
      }
    } catch (error) {
      Alert.alert("错误", "无法连接到服务器");
      console.error(error);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
  };

  if (isLoggedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>欢迎, {currentUser}!</Text>
        <Text style={styles.subtitle}>您已成功登录</Text>
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>退出登录</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isLoginMode ? "登录" : "注册"}</Text>
      
      <TextInput
        style={styles.input}
        placeholder="用户名"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="密码"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      {!isLoginMode && (
        <TextInput
          style={styles.input}
          placeholder="确认密码"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
      )}
      
      <TouchableOpacity style={styles.button} onPress={handleAuth}>
        <Text style={styles.buttonText}>{isLoginMode ? "登录" : "注册"}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => setIsLoginMode(!isLoginMode)}
      >
        <Text style={styles.switchButtonText}>
          {isLoginMode ? "没有账号？去注册" : "已有账号？去登录"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 30,
    color: "#666",
  },
  input: {
    width: "100%",
    height: 40,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  button: {
    width: "100%",
    height: 40,
    backgroundColor: "#007bff",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
    marginBottom: 15,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  switchButton: {
    marginTop: 10,
  },
  switchButtonText: {
    color: "#007bff",
    fontSize: 14,
  },
});
