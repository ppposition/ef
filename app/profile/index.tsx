import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.birthDate) {
        setBirthDate(new Date(user.birthDate));
      }
      if (user.height) {
        setHeight(user.height.toString());
      }
      if (user.weight) {
        setWeight(user.weight.toString());
      }
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const success = await updateUser({
        birthDate: birthDate ? birthDate.toISOString().split('T')[0] : undefined,
        height: height ? parseFloat(height) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
      });

      if (success) {
        Alert.alert('成功', '用户信息更新成功');
      } else {
        Alert.alert('错误', '更新用户信息失败');
      }
    } catch (error) {
      Alert.alert('错误', '无法连接到服务器');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '选择出生日期';
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\//g, '-');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>请先登录</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>个人信息</Text>
      
      <View style={styles.infoContainer}>
        <Text style={styles.label}>用户名</Text>
        <Text style={styles.value}>{user.username}</Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>出生日期</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateText}>{formatDate(birthDate)}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={birthDate || new Date()}
            mode="date"
            display="default"
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>身高 (厘米)</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入身高"
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
          editable={!isLoading}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>体重 (公斤)</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入体重"
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          editable={!isLoading}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.disabledButton]}
        onPress={handleSave}
        disabled={isLoading}
      >
        <Text style={styles.saveButtonText}>
          {isLoading ? '保存中...' : '保存信息'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
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
  infoContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#444',
  },
  value: {
    fontSize: 16,
    color: '#666',
  },
  inputContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
  },
  input: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    backgroundColor: 'white',
  },
  dateButton: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: 'white',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#4a90e2',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
});