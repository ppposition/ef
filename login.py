from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List
import hashlib

app = FastAPI()

# 添加CORS中间件，允许前端应用访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该指定具体的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 用户数据模型
class User(BaseModel):
    username: str
    password: str

# 用户登录模型
class UserLogin(BaseModel):
    username: str
    password: str

# 用户响应模型
class UserResponse(BaseModel):
    username: str
    message: str

# 模拟数据库
users_db: Dict[str, str] = {}  # 存储用户名和密码哈希

def hash_password(password: str) -> str:
    """对密码进行哈希处理"""
    return hashlib.sha256(password.encode()).hexdigest()

@app.get("/")
async def root():
    return {"message": "登录服务器运行中"}

@app.post("/register", response_model=UserResponse)
async def register(user: User):
    """用户注册"""
    if user.username in users_db:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 存储用户名和哈希后的密码
    users_db[user.username] = hash_password(user.password)
    
    return {"username": user.username, "message": "注册成功"}

@app.post("/login", response_model=UserResponse)
async def login(user: UserLogin):
    """用户登录"""
    if user.username not in users_db:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 验证密码
    hashed_password = hash_password(user.password)
    if users_db[user.username] != hashed_password:
        raise HTTPException(status_code=401, detail="密码错误")
    
    return {"username": user.username, "message": "登录成功"}

@app.get("/users")
async def get_users():
    """获取所有用户（仅用于演示）"""
    return {"users": list(users_db.keys())}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)