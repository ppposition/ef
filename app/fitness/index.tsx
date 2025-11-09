import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

const BODY_PARTS = ['胸', '背', '肩', '臂', '腿', '腹', '有氧'];

type Record = {
  id: number;
  date: string;
  part: string;
  exercise: string;
  sets: number | null;
  reps: number | null;
  distance: number | null;
  minutes: number | null;
  seconds: number | null;
};

type TimeRangeStats = {
  totalSessions: number;
  parts: {
    [key: string]: number;
  };
  records: Record[];
};

type StatsData = {
  currentWeek: TimeRangeStats;
  currentMonth: TimeRangeStats;
  monthlyStats: {
    [monthKey: string]: TimeRangeStats;
  };
};

export default function FitnessScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [selectedPart, setSelectedPart] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [distance, setDistance] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [inputMode, setInputMode] = useState<'sets' | 'distance' | 'time'>('sets');
  const [records, setRecords] = useState<Record[]>([]);
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<StatsData>({
    currentWeek: { totalSessions: 0, parts: {}, records: [] },
    currentMonth: { totalSessions: 0, parts: {}, records: [] },
    monthlyStats: {}
  });
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  useEffect(() => {
    if (user && token) {
      loadRecords();
    }
  }, [user, token]);

  useEffect(() => {
    calculateStats();
  }, [records]);

  const loadRecords = async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FITNESS_RECORDS}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      } else {
        Alert.alert('错误', '获取健身记录失败');
      }
    } catch (error) {
      Alert.alert('错误', '无法连接到服务器');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // 计算本周数据（从周一开始）
    const today = new Date(now);
    const dayOfWeek = today.getDay(); // 0是周日，1是周一...
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    
    const weeklyRecords = records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= monday;
    });

    // 计算当前月数据
    const currentMonthRecords = records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getFullYear() === currentYear &&
             recordDate.getMonth() === currentMonth;
    });

    // 按月份分组统计
    const monthlyStats: { [key: string]: TimeRangeStats } = {};
    records.forEach(record => {
      const recordDate = new Date(record.date);
      const monthKey = `${recordDate.getFullYear()}年${recordDate.getMonth() + 1}月`;
      
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          totalSessions: 0,
          parts: {},
          records: []
        };
      }

      monthlyStats[monthKey].totalSessions++;
      monthlyStats[monthKey].parts[record.part] = (monthlyStats[monthKey].parts[record.part] || 0) + 1;
      monthlyStats[monthKey].records.push(record);
    });

    // 计算本周统计
    const weeklyParts: { [key: string]: number } = {};
    weeklyRecords.forEach(record => {
      weeklyParts[record.part] = (weeklyParts[record.part] || 0) + 1;
    });

    // 计算当前月统计
    const currentMonthParts: { [key: string]: number } = {};
    currentMonthRecords.forEach(record => {
      currentMonthParts[record.part] = (currentMonthParts[record.part] || 0) + 1;
    });

    setStats({
      currentWeek: {
        totalSessions: weeklyRecords.length,
        parts: weeklyParts,
        records: weeklyRecords
      },
      currentMonth: {
        totalSessions: currentMonthRecords.length,
        parts: currentMonthParts,
        records: currentMonthRecords
      },
      monthlyStats
    });
  };

  const renderTimeRangeStats = (stats: TimeRangeStats) => (
    <>
      <View style={styles.statsContainer}>
        <Text>训练了{stats.totalSessions}次</Text>
        {Object.entries(stats.parts).map(([part, count]) => (
          <Text key={part}>{part}: {count}次</Text>
        ))}
      </View>
      <FlatList
        data={stats.records.map(record => ({
          ...record,
          date: `${record.date} 星期${getWeekday(record.date)}`
        }))}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={false}
      />
    </>
  );

  const saveRecord = async () => {
    if (!token || !selectedPart || (!exerciseName && !distance && !minutes && !seconds) || !date) {
      Alert.alert('错误', '请填写必要信息');
      return;
    }

    setIsLoading(true);
    try {
      const newRecord = {
        date: date.toISOString().split('T')[0],
        part: selectedPart,
        exercise: exerciseName,
        sets: sets ? parseInt(sets) : null,
        reps: reps ? parseInt(reps) : null,
        distance: distance ? parseFloat(distance) : null,
        minutes: minutes ? parseInt(minutes) : null,
        seconds: seconds ? parseInt(seconds) : null,
      };

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FITNESS_RECORDS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newRecord),
      });

      if (response.ok) {
        Alert.alert('成功', '健身记录保存成功');
        // 清空输入
        setExerciseName('');
        setSets('');
        setReps('');
        setDistance('');
        setMinutes('');
        setSeconds('');
        setInputMode('sets');
        setSelectedPart('');
        // 重新加载记录
        loadRecords();
      } else {
        Alert.alert('错误', '保存健身记录失败');
      }
    } catch (error) {
      Alert.alert('错误', '无法连接到服务器');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRecord = async (id: number) => {
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FITNESS_RECORDS}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // 从本地状态中移除记录
        setRecords(prevRecords => prevRecords.filter(record => record.id !== id));
      } else {
        Alert.alert('错误', '删除健身记录失败');
      }
    } catch (error) {
      Alert.alert('错误', '无法连接到服务器');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekday = (dateString: string) => {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const date = new Date(dateString);
    return days[date.getDay()];
  };

  const renderItem = ({ item }: { item: Record }) => (
    <View style={styles.recordItem}>
      <View style={styles.recordContent}>
        <Text style={styles.recordDate}>{item.date} {getWeekday(item.date)}</Text>
        <Text style={styles.recordPart}>{item.part}</Text>
        {item.sets && item.reps && <Text>{item.exercise}: {item.sets}组×{item.reps}次</Text>}
        {item.distance && <Text>{item.exercise}: {item.distance}米</Text>}
        {item.minutes !== null && item.seconds !== null && (
          <Text>{item.exercise}: {item.minutes}分{item.seconds}秒</Text>
        )}
      </View>
      <TouchableOpacity onPress={() => deleteRecord(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteText}>删除</Text>
      </TouchableOpacity>
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
      <ScrollView style={styles.scrollView}>
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => router.push('../main')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 返回主页</Text>
          </TouchableOpacity>
          <Text style={styles.title}>健身记录</Text>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.sectionTitle}>选择训练部位</Text>
          <View style={styles.partButtons}>
            {BODY_PARTS.map(part => (
              <TouchableOpacity
                key={part}
                style={[styles.partButton, selectedPart === part && styles.selectedPartButton]}
                onPress={() => setSelectedPart(part)}
                disabled={isLoading}
              >
                <Text style={selectedPart === part && styles.selectedPartText}>{part}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>训练内容</Text>
          <TextInput
            style={styles.input}
            placeholder="项目名称 (如: 引体向上)"
            value={exerciseName}
            onChangeText={setExerciseName}
            editable={!isLoading}
          />
          
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'sets' && styles.selectedModeButton]}
              onPress={() => setInputMode('sets')}
              disabled={isLoading}
            >
              <Text>组数×次数</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'distance' && styles.selectedModeButton]}
              onPress={() => setInputMode('distance')}
              disabled={isLoading}
            >
              <Text>跑步距离</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'time' && styles.selectedModeButton]}
              onPress={() => setInputMode('time')}
              disabled={isLoading}
            >
              <Text>锻炼时间</Text>
            </TouchableOpacity>
          </View>
          
          {inputMode === 'sets' && (
            <View style={styles.rowInput}>
              <TextInput
                style={[styles.input, styles.smallInput]}
                placeholder="组数"
                value={sets}
                onChangeText={setSets}
                keyboardType="numeric"
                editable={!isLoading}
              />
              <Text style={{alignSelf: 'center', marginHorizontal: 5}}>×</Text>
              <TextInput
                style={[styles.input, styles.smallInput]}
                placeholder="次数"
                value={reps}
                onChangeText={setReps}
                keyboardType="numeric"
                editable={!isLoading}
              />
            </View>
          )}
          
          {inputMode === 'distance' && (
            <TextInput
              style={styles.input}
              placeholder="跑步距离 (米)"
              value={distance}
              onChangeText={setDistance}
              keyboardType="numeric"
              editable={!isLoading}
            />
          )}
          
          {inputMode === 'time' && (
            <View style={styles.rowInput}>
              <TextInput
                style={[styles.input, styles.smallInput]}
                placeholder="分钟"
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="numeric"
                editable={!isLoading}
              />
              <Text style={{alignSelf: 'center', marginHorizontal: 5}}>:</Text>
              <TextInput
                style={[styles.input, styles.smallInput]}
                placeholder="秒钟"
                value={seconds}
                onChangeText={setSeconds}
                keyboardType="numeric"
                editable={!isLoading}
              />
            </View>
          )}
          
          <Text style={styles.sectionTitle}>训练日期</Text>
          <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dateButton} disabled={isLoading}>
            <Text>{date.toLocaleDateString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit'}).replace(/\//g, '-')}</Text>
          </TouchableOpacity>
          {showPicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') {
                  setShowPicker(false);
                }
                const currentDate = selectedDate || date;
                setDate(currentDate);
              }}
            />
          )}
          
          <TouchableOpacity 
            style={[styles.saveButton, isLoading && styles.disabledButton]} 
            onPress={saveRecord}
            disabled={isLoading}
          >
            <Text style={styles.saveButtonText}>{isLoading ? '保存中...' : '保存记录'}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'week' && styles.activeTab]}
            onPress={() => setActiveTab('week')}
          >
            <Text>本周统计</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'month' && styles.activeTab]}
            onPress={() => {
              setActiveTab('month');
              // 重置为当前月份
              setSelectedMonth(null);
            }}
          >
            <Text>月份统计</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'week' ? (
          renderTimeRangeStats(stats.currentWeek)
        ) : (
          <>
            {renderTimeRangeStats(stats.currentMonth)}
            <Text style={styles.sectionTitle}>历史月份</Text>
            <TouchableOpacity
              onPress={() => setShowMonthPicker(true)}
              style={styles.dateButton}
            >
              <Text>
                {selectedMonth
                  ? selectedMonth.toLocaleDateString('zh-CN', {year: 'numeric', month: 'long'})
                  : '选择月份'
                }
              </Text>
            </TouchableOpacity>
            {showMonthPicker && (
              <DateTimePicker
                testID="monthPicker"
                value={selectedMonth || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    setShowMonthPicker(false);
                  }
                  setSelectedMonth(selectedDate || null);
                }}
              />
            )}
            {selectedMonth && (() => {
              const monthKey = `${selectedMonth.getFullYear()}年${selectedMonth.getMonth() + 1}月`;
              const monthStats = stats.monthlyStats[monthKey];
              return monthStats ? renderTimeRangeStats(monthStats) : null;
            })()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
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
    marginBottom: 20,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
    color: '#444',
  },
  partButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  partButton: {
    padding: 8,
    margin: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  selectedPartButton: {
    backgroundColor: '#4a90e2',
  },
  selectedPartText: {
    color: 'white',
  },
  input: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  smallInput: {
    flex: 1,
    marginRight: 5,
  },
  rowInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modeButton: {
    flex: 1,
    padding: 8,
    marginHorizontal: 2,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    alignItems: 'center',
  },
  selectedModeButton: {
    backgroundColor: '#4a90e2',
  },
  dateButton: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: 'white',
    marginBottom: 15,
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
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 8,
    borderRadius: 4,
    elevation: 1,
  },
  recordContent: {
    flex: 1,
  },
  recordDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  recordPart: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#ff4444',
    borderRadius: 4,
  },
  deleteText: {
    color: 'white',
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 20,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#4a90e2',
  },
  statsContainer: {
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 8,
    borderRadius: 4,
    elevation: 1,
  },
});