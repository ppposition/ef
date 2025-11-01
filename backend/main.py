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
import json
import asyncio
from functools import wraps
from openai import OpenAI

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
LLM_API_URL = os.getenv("LLM_API_URL", "https://chat.sjtu.plus/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "sk-dHU4iob3mi1Bgkqr444dC5Be9d714758A2Ca05D30b201324")
LLM_MODEL = os.getenv("LLM_MODEL", "z-ai/glm-4.6")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "30"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))

# 初始化OpenAI客户端
client = OpenAI(
    api_key=LLM_API_KEY,
    base_url=LLM_API_URL
)

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

# 清理聊天记录，每个用户只保留最近10条
def cleanup_old_chat_messages():
    """清理聊天记录，确保每个用户只保留最近10条记录"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 获取所有用户ID
        cursor.execute("SELECT DISTINCT user_id FROM chat_messages")
        user_ids = cursor.fetchall()
        
        total_deleted = 0
        
        for user_row in user_ids:
            user_id = user_row["user_id"]
            
            # 获取该用户的所有聊天记录，按创建时间降序排列
            cursor.execute(
                """
                SELECT id FROM chat_messages
                WHERE user_id = ?
                ORDER BY created_at DESC
                """,
                (user_id,)
            )
            messages = cursor.fetchall()
            
            # 如果记录超过10条，删除多余的记录
            if len(messages) > 10:
                # 获取需要删除的记录ID（从第11条开始）
                ids_to_delete = [msg["id"] for msg in messages[10:]]
                
                # 构建删除查询
                placeholders = ','.join(['?' for _ in ids_to_delete])
                cursor.execute(
                    f"DELETE FROM chat_messages WHERE id IN ({placeholders})",
                    ids_to_delete
                )
                
                deleted_count = cursor.rowcount
                total_deleted += deleted_count
                
                if deleted_count > 0:
                    print(f"用户 {user_id}: 已删除 {deleted_count} 条旧聊天记录")
        
        conn.commit()
        conn.close()
        
        if total_deleted > 0:
            print(f"总共已删除 {total_deleted} 条旧聊天记录")
            
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
    exercise: str
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

# Agent可用的函数定义
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_date",
            "description": "获取当前日期",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_fitness_records_tool",
            "description": "获取健身记录，大模型应该根据用户对话内容智能判断所需的日期范围",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "开始日期，格式：YYYY-MM-DD，根据用户对话内容判断"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "结束日期，格式：YYYY-MM-DD，根据用户对话内容判断"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_profile_tool",
            "description": "获取用户的个人信息，包括身高、体重、出生日期等",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]

# 工具函数缓存，避免重复调用
_tool_cache = {}

async def get_current_date() -> str:
    """获取当前日期（带缓存）"""
    cache_key = "current_date"
    if cache_key in _tool_cache:
        return _tool_cache[cache_key]
    
    current_date = datetime.date.today().strftime('%Y-%m-%d')
    _tool_cache[cache_key] = current_date
    print(current_date)
    return current_date

async def get_fitness_records_tool(user_id: int, start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict]:
    """获取指定时间段的健身记录（工具函数版本，带缓存）"""
    # 创建缓存键
    cache_key = f"fitness_records_{user_id}_{start_date}_{end_date}"
    if cache_key in _tool_cache:
        return _tool_cache[cache_key]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 构建查询条件
    query = """
    SELECT date, part, exercise, sets, reps, distance, minutes, seconds
    FROM fitness_records
    WHERE user_id = ?
    """
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
    
    result = [dict(record) for record in records]
    _tool_cache[cache_key] = result
    return result

async def get_user_profile_tool(user_id: int) -> Dict:
    """获取用户个人信息（工具函数版本，带缓存）"""
    cache_key = f"user_profile_{user_id}"
    if cache_key in _tool_cache:
        return _tool_cache[cache_key]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT username, birth_date, height, weight FROM users WHERE id = ?",
        (user_id,)
    )
    user_info = cursor.fetchone()
    conn.close()
    
    result = dict(user_info) if user_info else {}
    _tool_cache[cache_key] = result
    return result

def clear_tool_cache():
    """清理工具函数缓存"""
    global _tool_cache
    _tool_cache.clear()

@retry_on_failure()
async def call_llm_api(user_message: str, user_id: int) -> str:
    """调用大模型API获取响应（支持function calling）"""
    
    # 构建系统提示词
    system_prompt = """
    你是一个专业的健身顾问AI助手。你可以根据用户的问题决定是否需要获取他们的健身记录或个人信息来提供更准确的建议。

    当用户询问关于特定时间段的健身记录、健身建议、训练计划等问题时，你应该按以下流程调用函数：
    
    1. 首先调用 get_current_date 获取当前日期
    2. 基于当前日期和用户的问题，智能计算所需的日期范围（如"最近一周"、"过去10天"、"上个月"等）
    3. 然后调用 get_fitness_records_tool 获取相应时间段的健身记录
    
    可用的函数：
    1. get_current_date - 获取当前日期
    2. get_fitness_records_tool - 获取健身记录，需要提供start_date和end_date参数
    3. get_user_profile_tool - 获取用户个人信息

    请根据用户的问题智能判断是否需要调用函数，以及调用哪个函数。如果不需要额外数据，可以直接回答。
    注意：避免重复调用相同的函数，系统会自动缓存结果。
    """
    
    try:
        # 使用OpenAI客户端调用API
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=3000,
            temperature=0.7
        )
        
        message = response.choices[0].message
        
        # 检查是否需要调用函数
        if message.tool_calls:
            return await handle_tool_calls(message.tool_calls, user_id, user_message)
        else:
            # 直接返回响应
            return message.content
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"调用大模型API时发生错误: {str(e)}"
        )
async def handle_tool_calls(tool_calls, user_id: int, user_message: str, messages: List[Dict] = None, iteration_count: int = 0) -> str:
    """处理函数调用，支持链式调用（带最大迭代次数限制）"""
    # 防止无限递归，最大迭代次数设为5
    MAX_ITERATIONS = 5
    if iteration_count >= MAX_ITERATIONS:
        return "抱歉，处理您的请求时遇到了问题，请重新表述您的问题。"
    
    if messages is None:
        messages = [
            {"role": "system", "content": "你是一个专业的健身顾问AI助手。基于获取到的数据，为用户提供专业的健身建议。"},
            {"role": "user", "content": user_message}
        ]
    
    tool_results = []
    
    for tool_call in tool_calls:
        function_name = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)
        print(function_name, arguments)
        
        if function_name == "get_current_date":
            current_date = await get_current_date()
            tool_results.append({
                "tool_call_id": tool_call.id,
                "result": {"current_date": current_date}
            })
        elif function_name == "get_fitness_records_tool":
            records = await get_fitness_records_tool(
                user_id,
                arguments.get("start_date"),
                arguments.get("end_date")
            )
            tool_results.append({
                "tool_call_id": tool_call.id,
                "result": records
            })
        elif function_name == "get_user_profile_tool":
            profile = await get_user_profile_tool(user_id)
            tool_results.append({
                "tool_call_id": tool_call.id,
                "result": profile
            })
    
    # 添加工具调用和结果到消息列表
    for tool_call in tool_calls:
        messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": [tool_call]
        })
    
    for result in tool_results:
        messages.append({
            "role": "tool",
            "tool_call_id": result["tool_call_id"],
            "content": json.dumps(result["result"], ensure_ascii=False)
        })
    
    try:
        # 使用OpenAI客户端调用API
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=3000,
            temperature=0.7
        )
        
        message = response.choices[0].message
        
        # 检查是否需要继续调用函数（链式调用）
        if message.tool_calls:
            return await handle_tool_calls(message.tool_calls, user_id, user_message, messages, iteration_count + 1)
        else:
            # 直接返回响应
            return message.content
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"调用大模型API时发生错误: {str(e)}"
        )



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
    
    # 清理工具缓存，确保获取最新数据
    clear_tool_cache()
    
    # 清理超过7天的旧聊天记录
    try:
        cleanup_old_chat_messages()
    except Exception as e:
        print(f"聊天时清理旧记录失败: {str(e)}")
        # 不影响正常聊天功能，继续执行
    
    # 保存用户消息
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_messages (user_id, message) VALUES (?, ?)",
        (user_id, chat_message.message)
    )
    message_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    
    try:
        # 调用大模型API获取响应
        ai_response = await call_llm_api(chat_message.message, user_id)
        
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
    limit: int = 10
):
    """获取聊天历史"""
    user_id = get_user_id(username)
    if not user_id:
        raise HTTPException(status_code=404, detail="用户不存在")
    
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