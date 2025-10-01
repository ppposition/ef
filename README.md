# 健身助手应用

这是一个基于React Native和FastAPI的健身助手应用，可以帮助用户记录健身数据、管理个人信息，并获取AI健身建议。

## 功能特点

### 前端功能
- 用户登录和注册
- 个人信息管理（出生日期、身高、体重）
- 健身记录管理（记录不同部位的训练、跑步距离、锻炼时间等）
- AI健身建议（基于用户的个人信息和健身记录提供个性化建议）

### 后端功能
- 用户认证和授权
- 用户信息存储和管理
- 健身记录存储和管理
- 聊天记录存储
- AI建议接口（可集成大模型API）

## 技术栈

### 前端
- React Native
- Expo Router
- TypeScript
- AsyncStorage
- DateTimePicker

### 后端
- FastAPI
- SQLite
- JWT认证
- Pydantic数据验证

## 安装和运行

### 后端设置

1. 进入后端目录：
```bash
cd backend
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

3. 启动后端服务器：
```bash
python main.py
```

后端服务器将在 `http://localhost:8000` 上运行。

### 前端设置

1. 进入前端目录：
```bash
cd app
```

2. 安装依赖：
```bash
npm install
```

3. 启动前端应用：
```bash
npm start
```

按照Expo的提示在模拟器或真实设备上运行应用。

## 使用说明

1. **注册/登录**：
   - 首次使用需要注册账号
   - 注册后可以使用用户名和密码登录

2. **个人信息管理**：
   - 登录后可以在"个人信息"页面设置出生日期、身高和体重
   - 这些信息将用于AI建议

3. **健身记录**：
   - 在"健身记录"页面可以记录不同类型的健身活动
   - 支持记录力量训练（组数和次数）、跑步（距离）和锻炼时间
   - 可以查看历史记录并删除不需要的记录

4. **AI建议**：
   - 在"AI建议"页面可以向AI咨询健身相关问题
   - AI将基于您的个人信息和健身记录提供个性化建议
   - 可以查看历史聊天记录

## API文档

后端API文档可以在 `http://localhost:8000/docs` 查看。

## 集成大模型API

在后端代码中，AI建议功能目前返回模拟响应。要集成真实的大模型API，请修改 `backend/main.py` 文件中的 `chat_with_ai` 函数：

```python
# 替换这部分代码
# 这里应该调用大模型API，但现在我们只返回一个模拟响应
# 在实际应用中，你需要替换为真实的大模型API调用
ai_response = f"根据您的健身记录和个人信息，我建议您：{chat_message.message}"
```

替换为您的大模型API调用代码。

## 项目结构

```
├── backend/                 # 后端代码
│   ├── main.py             # FastAPI应用主文件
│   └── requirements.txt    # Python依赖
├── app/                    # 前端代码
│   ├── auth/              # 认证相关组件
│   │   ├── AuthContext.tsx # 认证上下文
│   │   └── login.tsx      # 登录/注册页面
│   ├── profile/           # 个人信息页面
│   │   └── index.tsx      # 个人信息管理
│   ├── fitness/           # 健身记录页面
│   │   └── index.tsx      # 健身记录管理
│   ├── ai/                # AI建议页面
│   │   └── index.tsx      # AI建议界面
│   ├── main/              # 主页面
│   │   └── index.tsx      # 主菜单
│   ├── _layout.tsx        # 应用布局
│   └── index.tsx          # 首页
└── README.md              # 项目说明
```

## 贡献

欢迎提交问题和改进建议！

## 许可证

MIT
