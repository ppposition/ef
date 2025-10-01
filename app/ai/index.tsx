import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../auth/AuthContext';

type ChatMessage = {
  id: string;
  message: string;
  response: string;
  created_at: string;
};

export default function AIScreen() {
  const { user, token } = useAuth();
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (user && token) {
      loadChatHistory();
    }
  }, [user, token]);

  const loadChatHistory = async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/chat-history', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChatHistory(data);
      } else {
        console.error('获取聊天历史失败');
      }
    } catch (error) {
      console.error('无法连接到服务器', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!token || !message.trim()) {
      Alert.alert('错误', '请输入消息');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        // 将新消息添加到聊天历史顶部
        setChatHistory(prev => [
          {
            id: data.message_id,
            message: data.message,
            response: data.response,
            created_at: new Date().toISOString()
          },
          ...prev
        ]);
        setMessage('');
      } else {
        Alert.alert('错误', '发送消息失败');
      }
    } catch (error) {
      Alert.alert('错误', '无法连接到服务器');
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderChatMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.messageContainer}>
      <View style={styles.messageHeader}>
        <Text style={styles.messageTime}>{formatDateTime(item.created_at)}</Text>
      </View>
      
      <View style={styles.userMessage}>
        <Text style={styles.messageLabel}>您:</Text>
        <Text style={styles.messageText}>{item.message}</Text>
      </View>
      
      <View style={styles.aiResponse}>
        <Text style={styles.messageLabel}>AI建议:</Text>
        <Text style={styles.messageText}>{item.response}</Text>
      </View>
    </View>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>请先登录</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI健身建议</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="输入您的健身问题或需求..."
          value={message}
          onChangeText={setMessage}
          multiline
          editable={!isSending}
        />
        <TouchableOpacity 
          style={[styles.sendButton, isSending && styles.disabledButton]} 
          onPress={sendMessage}
          disabled={isSending}
        >
          <Text style={styles.sendButtonText}>
            {isSending ? '发送中...' : '发送'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.sectionTitle}>聊天记录</Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text>加载聊天历史中...</Text>
        </View>
      ) : (
        <FlatList
          data={chatHistory}
          renderItem={renderChatMessage}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>暂无聊天记录</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  inputContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  input: {
    height: 80,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: 'white',
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#4a90e2',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#444',
  },
  messageContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 1,
  },
  messageHeader: {
    marginBottom: 8,
  },
  messageTime: {
    fontSize: 12,
    color: '#888',
  },
  userMessage: {
    backgroundColor: '#e6f2ff',
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  aiResponse: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 4,
  },
  messageLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#444',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
});