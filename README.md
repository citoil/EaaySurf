# EasySurf

EasySurf 是一个智能的浏览器扩展，专为提升中国程序员的英文阅读体验而设计。它利用大语言模型的能力，提供即时翻译和智能注释功能，让英文阅读更轻松自然。

## 主要特性

### 1. 智能选词翻译
- 选中任意英文单词或短语，即时获取准确的中文翻译
- 翻译结果优雅地显示在原文上方
- 支持自动识别专业术语和常见表达

### 2. 段落难词注释
- 双击 Shift 键激活段落翻译功能
- 自动识别并标注段落中的难词
- 智能分析上下文，提供最贴切的中文释义
- 对已翻译的单词进行缓存，提高响应速度
- 相同单词仅在首次出现时显示翻译，减少视觉干扰

### 3. 优雅的视觉体验
- 翻译结果采用简洁的悬浮显示
- 难词标注使用优雅的绿色波浪下划线
- 适配深色/浅色主题
- 不影响原网页的排版和布局

### 4. 高性能设计
- 使用内存缓存存储翻译结果
- 智能防抖和节流处理
- 异步处理保证页面响应流畅
- 支持大规模文本的高效处理

## 安装说明

1. 克隆仓库到本地
```bash
git clone [repository-url]
```

2. 在 Chrome 浏览器中加载扩展：
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目目录

3. 配置 API：
   - 点击扩展图标
   - 点击"设置"
   - 输入你的 API Key
   - 选择 API 端点（支持 DeepSeek/OpenAI）

## 使用方法

### 选词翻译
1. 用鼠标选中任意英文单词或短语
2. 翻译结果会自动显示在选中文本的上方

### 段落难词注释
1. 将鼠标悬停在要翻译的段落上
2. 双击 Shift 键
3. 插件会自动识别并标注段落中的难词
4. 难词会显示绿色波浪下划线，翻译显示在上方

### 功能开关
- 在扩展的弹出窗口中可以：
  - 启用/禁用选词翻译
  - 启用/禁用段落翻译
  - 访问更多设置选项

## 技术栈

- Chrome Extension Manifest V3
- JavaScript (ES6+)
- DeepSeek/OpenAI API
- CSS3 动画和过渡效果

## 注意事项

- 使用前请确保已配置有效的 API Key
- 建议使用最新版本的 Chrome 浏览器
- 如遇到问题，可以尝试刷新页面或重启浏览器

## 开发计划

- [ ] 全文翻译功能（开发中）
- [ ] 自定义样式设置
- [ ] 更多 API 供应商支持
- [ ] 离线词典支持
- [ ] 生词本功能

## 许可证

MIT License 