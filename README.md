# New Boy

## 开发环境要求

- Node.js v22.x
- npm v10.x 或更高版本
- Python 3.10.x
- pip (最新版本)

## 安装步骤

1. 克隆项目
```bash
git clone https://github.com/ruiange/new_boy.git
cd new_boy
```

2. 准备 Python 环境
```bash
# 下载 Python 3.10 嵌入式版本并解压到 python 目录
# 下载地址：https://www.python.org/downloads/windows/
# 选择：Windows embeddable package (64-bit) for Python 3.10.x

# 创建 python 目录
mkdir python

# 解压下载的 python-3.10.x-embed-amd64.zip 到 python 目录
# 确保 python 目录中包含 python310.dll, python.exe 等文件

# 下载 get-pip.py
curl https://bootstrap.pypa.io/get-pip.py -o python/get-pip.py

# 安装 pip
cd python
python get-pip.py
cd ..

# 将 python 目录提交到 git
git add python
git commit -m "添加 Python 运行环境"
git push
```

3. 安装 Python 依赖
```bash
# 创建并激活虚拟环境
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# 安装依赖
pip install -r requirements.txt

# 将安装的依赖复制到指定目录
mkdir -p site-packages
cp -r .venv/Lib/site-packages/* site-packages/

# 将依赖提交到 git
git add site-packages
git commit -m "添加 Python 依赖"
git push
```

4. 安装 Node.js 依赖
```bash
# 安装项目依赖
npm ci  # 推荐使用 ci 而不是 install，以确保版本一致性

# 全局安装 electron-builder（如果需要构建安装包）
npm install -g electron-builder
```

5. 开发模式运行
```bash
npm run dev
```

6. 构建应用
```bash
npm run build
```

## 发布新版本

1. 更新版本号
```bash
npm version patch  # 更新补丁版本 (0.0.x)
# 或
npm version minor  # 更新次要版本 (0.x.0)
# 或
npm version major  # 更新主要版本 (x.0.0)
```

2. 推送标签触发自动构建
```bash
git push
git push --tags
```

构建完成后，可以在 GitHub Releases 页面找到安装包。

## 目录结构

```
new_boy/
├── src/                    # 源代码目录
├── dist/                   # 构建输出目录
├── build/                  # 构建相关配置
├── python/                 # Python 运行环境（需要提交到 git）
├── site-packages/          # Python 依赖包（需要提交到 git）
├── .venv/                  # Python 虚拟环境（开发用，不提交）
├── requirements.txt        # Python 依赖清单
└── package.json            # 项目配置文件
```

## 常见问题

1. 如果安装 Node.js 依赖时遇到问题，可以尝试：
```bash
npm cache clean --force
rm -rf node_modules
npm ci
```

2. 如果安装 Python 依赖时遇到问题：
```bash
# 清理虚拟环境
deactivate  # 如果在虚拟环境中
rm -rf .venv
rm -rf site-packages

# 重新创建虚拟环境
python -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

# 重新复制依赖
mkdir -p site-packages
cp -r .venv/Lib/site-packages/* site-packages/
```

3. Python 环境问题：
- 确保使用的是 Python 3.10.x 的嵌入式版本
- 检查 python 目录中是否包含所有必要文件
- 确保 pip 已正确安装在 python 目录中

4. 如果构建失败，请确保：
- Node.js 版本正确
- Python 3.10.x 已正确安装
- 已全局安装 electron-builder
- 所有依赖都已正确安装
- `site-packages` 目录包含所有必要的 Python 依赖
- `python` 目录包含完整的 Python 运行环境

## 许可证

[MIT License](LICENSE)