# New Boy

## 开发环境要求

- Node.js v22.x
- npm v10.x 或更高版本

## 安装步骤

1. 克隆项目
```bash
git clone https://github.com/ruiange/new_boy.git
cd new_boy
```

2. 安装依赖
```bash
# 安装项目依赖
npm ci  # 推荐使用 ci 而不是 install，以确保版本一致性

# 全局安装 electron-builder（如果需要构建安装包）
npm install -g electron-builder
```

3. 开发模式运行
```bash
npm run dev
```

4. 构建应用
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
├── src/              # 源代码目录
├── dist/             # 构建输出目录
├── build/            # 构建相关配置
└── package.json      # 项目配置文件
```

## 常见问题

1. 如果安装依赖时遇到问题，可以尝试：
```bash
npm cache clean --force
rm -rf node_modules
npm ci
```

2. 如果构建失败，请确保：
- Node.js 版本正确
- 已全局安装 electron-builder
- 所有依赖都已正确安装

## 许可证

[MIT License](LICENSE)