import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SQLite from 'react-native-sqlite-storage';

// 打开或创建数据库
const db = SQLite.openDatabase(
  {
    name: 'FitnessDB',
    location: 'default',
  },
  () => {},
  error => {
    console.error('Failed to open database', error);
  }
);

const BODY_PARTS = ['胸', '背', '肩', '臂', '腿', '腹', '有氧'];

type Record = {
  id: string;
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


const App = () => {
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
  const [stats, setStats] = useState<StatsData>({
    currentWeek: { totalSessions: 0, parts: {}, records: [] },
    currentMonth: { totalSessions: 0, parts: {}, records: [] },
    monthlyStats: {}
  });
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // 初始化数据库表
  useEffect(() => {
    db.transaction(tx => {
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, date TEXT, part TEXT, exercise TEXT, sets INTEGER, reps INTEGER, distance REAL, minutes INTEGER, seconds INTEGER);',
        [],
        () => console.log('Table created successfully'),
        error => console.error('Failed to create table', error)
      );
    });
    loadRecords();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [records]);

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
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
      />
    </>
  );

  const loadRecords = () => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM records ORDER BY date DESC;',
        [],
        (_, results) => {
          const rows = results.rows;
          const loadedRecords: Record[] = [];
          for (let i = 0; i < rows.length; i++) {
            loadedRecords.push(rows.item(i));
          }
          setRecords(loadedRecords);
        },
        error => {
          console.error('Failed to load records', error);
          return false;
        }
      );
    });
  };

  const saveRecord = () => {
    if (!selectedPart || (!exerciseName && !distance && !minutes && !seconds) || !date) return;

    const newRecord = {
      id: Date.now().toString(),
      date: date ? formatDate(date) : '',
      part: selectedPart,
      exercise: exerciseName,
      sets: sets ? parseInt(sets) : null,
      reps: reps ? parseInt(reps) : null,
      distance: distance ? parseFloat(distance) : null,
      minutes: minutes ? parseInt(minutes) : null,
      seconds: seconds ? parseInt(seconds) : null,
    };

    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO records (id, date, part, exercise, sets, reps, distance, minutes, seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [
          newRecord.id,
          newRecord.date,
          newRecord.part,
          newRecord.exercise,
          newRecord.sets,
          newRecord.reps,
          newRecord.distance,
          newRecord.minutes,
          newRecord.seconds,
        ],
        () => {
          setRecords(prevRecords => [...prevRecords, newRecord]);
          // 清空输入
          setExerciseName('');
          setSets('');
          setReps('');
          setDistance('');
          setMinutes('');
          setSeconds('');
          setInputMode('sets');
        },
        error => {
          console.error('Failed to save record', error);
          return false;
        }
      );
    });
  };

  const deleteRecord = (id: string) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM records WHERE id = ?;',
        [id],
        () => {
          setRecords(prevRecords => prevRecords.filter(record => record.id !== id));
        },
        error => {
          console.error('Failed to delete record', error);
          return false;
        }
      );
    });
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
        <Text style={styles.recordDate}>{item.date}</Text>
        <Text style={styles.recordPart}>{item.part}</Text>
        {item.exercise && item.sets && item.reps && <Text>{item.exercise}: {item.sets}组×{item.reps}次</Text>}
        {item.distance && <Text>跑步: {item.distance}米</Text>}
        {item.minutes !== null && item.seconds !== null && (
          <Text>锻炼时间: {item.minutes}分{item.seconds}秒</Text>
        )}
      </View>
      <TouchableOpacity onPress={() => deleteRecord(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteText}>删除</Text>
      </TouchableOpacity>
    </View>
  );

  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>健身记录</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.sectionTitle}>选择训练部位</Text>
          <View style={styles.partButtons}>
            {BODY_PARTS.map(part => (
              <TouchableOpacity
                key={part}
                style={[styles.partButton, selectedPart === part && styles.selectedPartButton]}
                onPress={() => setSelectedPart(part)}
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
          />
          
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'sets' && styles.selectedModeButton]}
              onPress={() => setInputMode('sets')}
            >
              <Text>组数×次数</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'distance' && styles.selectedModeButton]}
              onPress={() => setInputMode('distance')}
            >
              <Text>跑步距离</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, inputMode === 'time' && styles.selectedModeButton]}
              onPress={() => setInputMode('time')}
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
              />
              <Text style={{alignSelf: 'center', marginHorizontal: 5}}>×</Text>
              <TextInput
                style={[styles.input, styles.smallInput]}
                placeholder="次数"
                value={reps}
                onChangeText={setReps}
                keyboardType="numeric"
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
              />
              <Text style={{alignSelf: 'center', marginHorizontal: 5}}>:</Text>
              <TextInput
                style={[styles.input, styles.smallInput]}
                placeholder="秒钟"
                value={seconds}
                onChangeText={setSeconds}
                keyboardType="numeric"
              />
            </View>
          )}
          
          <Text style={styles.sectionTitle}>训练日期</Text>
          <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dateButton}>
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
          
          <TouchableOpacity style={styles.saveButton} onPress={saveRecord}>
            <Text style={styles.saveButtonText}>保存记录</Text>
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
              const now = new Date();
              setSelectedMonth('');
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
            <View style={styles.monthSelector}>
              {Object.keys(stats.monthlyStats)
                .sort((a, b) => b.localeCompare(a))
                .map(month => (
                  <TouchableOpacity
                    key={month}
                    style={[styles.monthButton, selectedMonth === month && styles.selectedMonthButton]}
                    onPress={() => setSelectedMonth(month === selectedMonth ? '' : month)}
                  >
                    <Text>{month}</Text>
                  </TouchableOpacity>
                ))}
            </View>
            {selectedMonth && stats.monthlyStats[selectedMonth] && (
              renderTimeRangeStats(stats.monthlyStats[selectedMonth])
            )}
          </>
        )}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  monthSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  monthButton: {
    padding: 8,
    margin: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  selectedMonthButton: {
    backgroundColor: '#4a90e2',
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
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
  orText: {
    textAlign: 'center',
    marginVertical: 10,
    color: '#888',
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
});

export default App;