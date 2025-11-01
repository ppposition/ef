import { useRouter } from 'expo-router';
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
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

type ChatMessage = {
  id: string;
  message: string;
  response: string;
  created_at: string;
};

export default function AIScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
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
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHAT_HISTORY}`, {
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
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CHAT}`, {
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
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => router.push('../main')} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 返回主页</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AI健身建议</Text>
      </View>
      
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
      
      <Text style={styles.sectionTitle}>快速提问</Text>
      <View style={styles.quickPromptsContainer}>
        <TouchableOpacity
          style={styles.quickPromptButton}
          onPress={() => setMessage('请结合我的身高体重与健身记录，给出接下来的健身建议，比如应该增强哪个部位训练，什么时候应该增加锻炼的重量等')}
        >
          <Text style={styles.quickPromptText}>获取个性化健身建议</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickPromptButton}
          onPress={() => setMessage('根据我的健身记录，帮我制定一个下周的训练计划')}
        >
          <Text style={styles.quickPromptText}>制定下周训练计划</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickPromptButton}
          onPress={() => setMessage('我最近训练效果如何？有什么需要改进的地方吗？')}
        >
          <Text style={styles.quickPromptText}>评估训练效果</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickPromptButton}
          onPress={() => setMessage('请推荐一些适合我当前体能水平的营养建议')}
        >
          <Text style={styles.quickPromptText}>获取营养建议</Text>
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    backgroundColor: '#4a90e2',
    borderRadius: 4,
    marginRight: 10,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
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
    lineHeight: 22,
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
  quickPromptsContainer: {
    marginBottom: 20,
  },
  quickPromptButton: {
    backgroundColor: '#e6f2ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  quickPromptText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});