from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Dict, List, Optional
import hashlib
import datetime
from datetime import date
import sqlite3
import os
import uuid
import httpx
import json
import asyncio
from functools import wraps

app = FastAPI()

# 添加CORS中间件，允许前端应用访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该指定具体的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT配置
SECRET_KEY = "your_secret_key_here"  # 在生产环境中应该使用环境变量
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 安全认证
security = HTTPBearer()

# 数据库路径
DB_PATH = "fitness_app.db"

# 大模型API配置
LLM_API_URL = os.getenv("LLM_API_URL", "https://chat.sjtu.plus/v1/chat/completions")
LLM_API_KEY = os.getenv("LLM_API_KEY", "sk-dHU4iob3mi1Bgkqr444dC5Be9d714758A2Ca05D30b201324")
LLM_MODEL = os.getenv("LLM_MODEL", "z-ai/glm-4.6")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "30"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))

# 创建数据库连接
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# 初始化数据库
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 创建用户表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        birth_date TEXT,
        height REAL,
        weight REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 创建健身记录表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fitness_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        part TEXT NOT NULL,
        exercise TEXT,
        sets INTEGER,
        reps INTEGER,
        distance REAL,
        minutes INTEGER,
        seconds INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)
    
    # 创建聊天记录表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)
    
    conn.commit()
    conn.close()

# 启动时初始化数据库
init_db()

# 清理超过7天的聊天记录
def cleanup_old_chat_messages():
    """删除超过7天的聊天记录"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 计算7天前的日期
        seven_days_ago = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute(
            "DELETE FROM chat_messages WHERE created_at < ?",
            (seven_days_ago,)
        )
        
        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()
        
        if deleted_count > 0:
            print(f"已删除 {deleted_count} 条超过7天的聊天记录")
    except Exception as e:
        print(f"清理旧聊天记录时出错: {str(e)}")
        # 确保连接被关闭
        try:
            conn.close()
        except:
            pass

# 启动时清理旧记录
try:
    cleanup_old_chat_messages()
except Exception as e:
    print(f"启动时清理旧记录失败: {str(e)}")

# 用户数据模型
class User(BaseModel):
    username: str
    password: str

# 用户登录模型
class UserLogin(BaseModel):
    username: str
    password: str

# 用户信息模型
class UserInfo(BaseModel):
    birth_date: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None

# 用户响应模型
class UserResponse(BaseModel):
    username: str
    message: str

# 健身记录模型
class FitnessRecord(BaseModel):
    date: str
    part: str
    exercise: Optional[str] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    distance: Optional[float] = None
    minutes: Optional[int] = None
    seconds: Optional[int] = None

# 聊天消息模型
class ChatMessage(BaseModel):
    message: str

# 令牌响应模型
class Token(BaseModel):
    access_token: str
    token_type: str

def hash_password(password: str) -> str:
    """对密码进行哈希处理"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None):
    """创建简单的访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    to_encode.update({"exp": expire.timestamp()})
    
    # 使用简单的令牌生成方式，避免JWT库的兼容性问题
    token_data = f"{to_encode['sub']}:{expire.timestamp()}:{uuid.uuid4().hex}"
    return token_data

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """验证访问令牌"""
    token = credentials.credentials
    try:
        # 简单的令牌验证
        parts = token.split(':')
        if len(parts) < 3:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭据",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        username = parts[0]
        expire_timestamp = float(parts[1])
        
        # 检查令牌是否过期
        if datetime.datetime.utcnow().timestamp() > expire_timestamp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="令牌已过期",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return username
    except (ValueError, IndexError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_user_id(username: str):
    """获取用户ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    return user["id"] if user else None

def retry_on_failure(max_retries=LLM_MAX_RETRIES, delay=1):
    """重试装饰器，用于API调用失败时重试"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        await asyncio.sleep(delay * (2 ** attempt))  # 指数退避
                    else:
                        raise last_exception
            return None
        return wrapper
    return decorator

@retry_on_failure()
async def call_llm_api(user_message: str, user_context: Dict) -> str:
    """调用大模型API获取响应"""
    
    # 构建系统提示词，包含用户上下文信息
    system_prompt = f"""
    你是一个专业的健身顾问AI助手。请根据用户的个人信息和健身记录提供专业的健身建议。
    
    用户信息：
    - 用户名：{user_context.get('username', '未知')}
    - 出生日期：{user_context.get('birth_date', '未知')}
    - 身高：{user_context.get('height', '未知')} cm
    - 体重：{user_context.get('weight', '未知')} kg
    
    最近的健身记录：
    {format_fitness_records(user_context.get('recent_fitness_records', []))}
    
    请根据这些信息，针对用户的问题提供专业、个性化的健身建议。回答要简洁明了，重点突出。
    """
    
    # 准备请求数据
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "max_tokens": 3000,
        "temperature": 0.7
    }
    
    # 发送请求
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        try:
            response = await client.post(LLM_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            
            result = response.json()
            
            # 解析响应（根据不同API格式可能需要调整）
            if "choices" in result and len(result["choices"]) > 0:
                return result["choices"][0]["message"]["content"]
            else:
                raise ValueError("API响应格式不正确")
                
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"大模型API调用失败: {e.response.text}"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=500,
                detail=f"网络请求失败: {str(e)}"
            )
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
                detail="API响应解析失败"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"调用大模型API时发生错误: {str(e)}"
            )

def format_fitness_records(records: List[Dict]) -> str:
    """格式化健身记录为可读文本"""
    if not records:
        return "暂无健身记录"
    
    formatted = []
    for record in records:
        date = record.get('date', '未知日期')
        part = record.get('part', '未知部位')
        exercise = record.get('exercise', '')
        sets = record.get('sets', '')
        reps = record.get('reps', '')
        distance = record.get('distance', '')
        minutes = record.get('minutes', '')
        seconds = record.get('seconds', '')
        
        record_text = f"- {date} {part}"
        if exercise:
            record_text += f" - {exercise}"
        if sets and reps:
            record_text += f" ({sets}组 × {reps}次)"
        if distance:
            record_text += f" - {distance}米"
        if minutes or seconds:
            record_text += f" - {minutes}分{seconds}秒"
        
        formatted.append(record_text)
    
    return "\n".join(formatted)

@app.get("/")
async def root():
    return {"message": "健身应用服务器运行中"}

@app.post("/register", response_model=UserResponse)
async def register(user: User):
    """用户注册"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 检查用户名是否已存在
    cursor.execute("SELECT id FROM users WHERE username = ?", (user.username,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 存储用户名和哈希后的密码
    password_hash = hash_password(user.password)
    cursor.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (user.username, password_hash)
    )
    
    conn.commit()
    conn.close()
    
    return {"username": user.username, "message": "注册成功"}

@app.post("/login", response_model=Token)
async def login(user: UserLogin):
    """用户登录"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 查找用户
    cursor.execute("SELECT id, password_hash FROM users WHERE username = ?", (user.username,))
    user_data = cursor.fetchone()
    conn.close()
    
    if not user_data:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 验证密码
    password_hash = hash_password(user.password)
    if user_data["password_hash"] != password_hash:
        raise HTTPException(status_code=401, detail="密码错误")
    
    # 创建访问令牌
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=Dict)
async def get_current_user(username: str = Depends(verify_token)):
    """获取当前用户信息"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT id, username, birth_date, height, weight FROM users WHERE username = ?",
        (username,)
    )
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    return {
        "id": user["id"],
        "username": user["username"],
        "birth_date": user["birth_date"],
        "height": user["height"],
        "weight": user["weight"]
    }

@app.put("/users/me", response_model=UserResponse)
async def update_user_info(
    user_info: UserInfo,
    username: str = Depends(verify_token)
):
    """更新用户信息"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 更新用户信息
    cursor.execute(
        """
        UPDATE users 
        SET birth_date = ?, height = ?, weight = ?
        WHERE username = ?
        """,
        (user_info.birth_date, user_info.height, user_info.weight, username)
    )
    
    conn.commit()
    conn.close()
    
    return {"username": username, "message": "用户信息更新成功"}

@app.post("/fitness-records", response_model=Dict)
async def create_fitness_record(
    record: FitnessRecord,
    username: str = Depends(verify_token)
):
    """创建健身记录"""
    user_id = get_user_id(username)
    if not user_id:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        """
        INSERT INTO fitness_records 
        (user_id, date, part, exercise, sets, reps, distance, minutes, seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id, record.date, record.part, record.exercise,
            record.sets, record.reps, record.distance, record.minutes, record.seconds
        )
    )
    
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {"id": record_id, "message": "健身记录创建成功"}

@app.get("/fitness-records", response_model=List[Dict])
async def get_fitness_records(
    username: str = Depends(verify_token),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """获取健身记录"""
    user_id = get_user_id(username)
    if not user_id:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM fitness_records WHERE user_id = ?"
    params = [user_id]
    
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
    
    query += " ORDER BY date DESC"
    
    cursor.execute(query, params)
    records = cursor.fetchall()
    conn.close()
    
    return [dict(record) for record in records]

@app.delete("/fitness-records/{record_id}", response_model=Dict)
async def delete_fitness_record(
    record_id: int,
    username: str = Depends(verify_token)
):
    """删除健身记录"""
    user_id = get_user_id(username)
    if not user_id:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 检查记录是否存在且属于当前用户
    cursor.execute(
        "SELECT id FROM fitness_records WHERE id = ? AND user_id = ?",
        (record_id, user_id)
    )
    record = cursor.fetchone()
    
    if not record:
        conn.close()
        raise HTTPException(status_code=404, detail="健身记录不存在")
    
    # 删除记录
    cursor.execute(
        "DELETE FROM fitness_records WHERE id = ?",
        (record_id,)
    )
    
    conn.commit()
    conn.close()
    
    return {"message": "健身记录删除成功"}

@app.post("/chat", response_model=Dict)
async def chat_with_ai(
    chat_message: ChatMessage,
    username: str = Depends(verify_token)
):
    """与大模型聊天"""
    user_id = get_user_id(username)
    if not user_id:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 清理超过7天的旧聊天记录
    try:
        cleanup_old_chat_messages()
    except Exception as e:
        print(f"聊天时清理旧记录失败: {str(e)}")
        # 不影响正常聊天功能，继续执行
    
    # 获取用户信息
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT birth_date, height, weight FROM users WHERE id = ?",
        (user_id,)
    )
    user_info = cursor.fetchone()
    
    # 获取最近的健身记录
    cursor.execute(
        """
        SELECT date, part, exercise, sets, reps, distance, minutes, seconds
        FROM fitness_records
        WHERE user_id = ?
        ORDER BY date DESC
        LIMIT 10
        """,
        (user_id,)
    )
    recent_records = cursor.fetchall()
    
    # 保存用户消息
    cursor.execute(
        "INSERT INTO chat_messages (user_id, message) VALUES (?, ?)",
        (user_id, chat_message.message)
    )
    message_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    
    # 准备发送给大模型的数据
    user_context = {
        "username": username,
        "birth_date": user_info["birth_date"] if user_info else None,
        "height": user_info["height"] if user_info else None,
        "weight": user_info["weight"] if user_info else None,
        "recent_fitness_records": [dict(record) for record in recent_records]
    }
    
    try:
        # 调用大模型API获取响应
        ai_response = await call_llm_api(chat_message.message, user_context)
        
        # 更新聊天记录，添加AI响应
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE chat_messages SET response = ? WHERE id = ?",
            (ai_response, message_id)
        )
        conn.commit()
        conn.close()
        
        return {
            "message": chat_message.message,
            "response": ai_response,
            "message_id": message_id
        }
        
    except HTTPException:
        # 如果是HTTPException，直接重新抛出
        raise
    except Exception as e:
        # 其他异常，记录错误并返回友好提示
        conn = get_db_connection()
        cursor = conn.cursor()
        error_response = f"抱歉，服务暂时不可用，请稍后再试。错误信息：{str(e)}"
        cursor.execute(
            "UPDATE chat_messages SET response = ? WHERE id = ?",
            (error_response, message_id)
        )
        conn.commit()
        conn.close()
        
        return {
            "message": chat_message.message,
            "response": error_response,
            "message_id": message_id,
            "error": True
        }

@app.get("/chat-history", response_model=List[Dict])
async def get_chat_history(
    username: str = Depends(verify_token),
    limit: int = 20
):
    """获取聊天历史"""
    user_id = get_user_id(username)
    if not user_id:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 先清理当前用户的旧记录
    try:
        cleanup_old_chat_messages()
    except Exception as e:
        print(f"获取聊天历史时清理旧记录失败: {str(e)}")
        # 不影响获取聊天历史，继续执行
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        """
        SELECT id, message, response, created_at
        FROM chat_messages
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (user_id, limit)
    )
    messages = cursor.fetchall()
    conn.close()
    
    return [dict(message) for message in messages]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)