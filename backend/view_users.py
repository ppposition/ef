#!/usr/bin/env python3
"""
查看当前数据库中所有用户的脚本
"""

import sqlite3
import os
from datetime import datetime

# 数据库路径
DB_PATH = "fitness_app.db"

def get_db_connection():
    """创建数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def view_all_users():
    """查看所有用户信息"""
    if not os.path.exists(DB_PATH):
        print(f"❌ 数据库文件 {DB_PATH} 不存在")
        return
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 查询所有用户
        cursor.execute("""
            SELECT id, username, birth_date, height, weight, created_at
            FROM users
            ORDER BY created_at DESC
        """)
        users = cursor.fetchall()
        
        if not users:
            print("📝 数据库中没有用户")
            return
        
        print(f"👥 共找到 {len(users)} 个用户:")
        print("=" * 80)
        
        for user in users:
            print(f"🆔 ID: {user['id']}")
            print(f"👤 用户名: {user['username']}")
            print(f"🎂 出生日期: {user['birth_date'] or '未设置'}")
            print(f"📏 身高: {user['height'] or '未设置'} cm")
            print(f"⚖️ 体重: {user['weight'] or '未设置'} kg")
            print(f"📅 注册时间: {user['created_at']}")
            
            # 查询用户的健身记录数量
            cursor.execute(
                "SELECT COUNT(*) as count FROM fitness_records WHERE user_id = ?",
                (user['id'],)
            )
            fitness_count = cursor.fetchone()['count']
            print(f"💪 健身记录数: {fitness_count}")
            
            # 查询用户的聊天记录数量
            cursor.execute(
                "SELECT COUNT(*) as count FROM chat_messages WHERE user_id = ?",
                (user['id'],)
            )
            chat_count = cursor.fetchone()['count']
            print(f"💬 聊天记录数: {chat_count}")
            
            print("-" * 80)
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ 数据库错误: {e}")
    except Exception as e:
        print(f"❌ 发生错误: {e}")

def view_user_details(username):
    """查看特定用户的详细信息"""
    if not os.path.exists(DB_PATH):
        print(f"❌ 数据库文件 {DB_PATH} 不存在")
        return
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 查询用户信息
        cursor.execute(
            "SELECT * FROM users WHERE username = ?",
            (username,)
        )
        user = cursor.fetchone()
        
        if not user:
            print(f"❌ 用户 '{username}' 不存在")
            return
        
        print(f"👤 用户详细信息: {username}")
        print("=" * 80)
        print(f"🆔 ID: {user['id']}")
        print(f"🎂 出生日期: {user['birth_date'] or '未设置'}")
        print(f"📏 身高: {user['height'] or '未设置'} cm")
        print(f"⚖️ 体重: {user['weight'] or '未设置'} kg")
        print(f"📅 注册时间: {user['created_at']}")
        
        # 查询最近的健身记录
        cursor.execute(
            """
            SELECT date, part, exercise, sets, reps, distance, minutes, seconds
            FROM fitness_records 
            WHERE user_id = ? 
            ORDER BY date DESC 
            LIMIT 5
            """,
            (user['id'],)
        )
        records = cursor.fetchall()
        
        print(f"\n💪 最近的健身记录 (最多5条):")
        if records:
            for i, record in enumerate(records, 1):
                print(f"  {i}. {record['date']} - {record['part']}")
                if record['exercise']:
                    print(f"     动作: {record['exercise']}")
                if record['sets'] and record['reps']:
                    print(f"     组数×次数: {record['sets']} × {record['reps']}")
                if record['distance']:
                    print(f"     距离: {record['distance']} 米")
                if record['minutes'] or record['seconds']:
                    print(f"     时长: {record['minutes']}分{record['seconds']}秒")
        else:
            print("  暂无健身记录")
        
        # 查询最近的聊天记录
        cursor.execute(
            """
            SELECT message, response, created_at
            FROM chat_messages 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 3
            """,
            (user['id'],)
        )
        messages = cursor.fetchall()
        
        print(f"\n💬 最近的聊天记录 (最多3条):")
        if messages:
            for i, msg in enumerate(messages, 1):
                print(f"  {i}. 时间: {msg['created_at']}")
                print(f"     用户: {msg['message'][:50]}{'...' if len(msg['message']) > 50 else ''}")
                if msg['response']:
                    print(f"     AI: {msg['response'][:50]}{'...' if len(msg['response']) > 50 else ''}")
        else:
            print("  暂无聊天记录")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ 数据库错误: {e}")
    except Exception as e:
        print(f"❌ 发生错误: {e}")

def main():
    """主函数"""
    print("🔍 健身应用用户查看工具")
    print("=" * 50)
    
    while True:
        print("\n请选择操作:")
        print("1. 查看所有用户")
        print("2. 查看特定用户详情")
        print("3. 退出")
        
        choice = input("\n请输入选项 (1-3): ").strip()
        
        if choice == "1":
            view_all_users()
        elif choice == "2":
            username = input("请输入用户名: ").strip()
            if username:
                view_user_details(username)
            else:
                print("❌ 用户名不能为空")
        elif choice == "3":
            print("👋 再见!")
            break
        else:
            print("❌ 无效选项，请重新选择")

if __name__ == "__main__":
    main()