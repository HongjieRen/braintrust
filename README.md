# braintrust

同题多模型融合器 — 把同一个问题同时发给 Claude、Codex、Antigravity（Gemini），然后用一个 Judge 综合出"集大成方案"。

```
输入 → 核心模型并发生成 → 清洗归一化 → Judge 融合 → 输出 + 落盘
```

默认运行 Claude、Codex、Antigravity（Gemini）；可选 provider 必须显式启用。

---

## 安装

```bash
# 克隆
git clone https://github.com/HongjieRen/braintrust.git
cd braintrust

# 软链接到 PATH
ln -sf "$(pwd)/bin/braintrust" ~/.local/bin/braintrust
chmod +x bin/braintrust
```

**前置依赖**（默认三个核心 CLI 均需已登录）：

| Provider | CLI | 验证命令 |
|----------|-----|---------|
| Claude | `claude` | `claude -p "hi" --output-format json` |
| OpenAI Codex | `codex` | `codex exec "hi" --json --skip-git-repo-check --ephemeral` |
| Google Gemini | `agy` | `agy -p "hi" --output-format json --disable-slash-commands` |

---

## 用法

```bash
braintrust "解释 CAP 定理"                      # 默认：3 generator + 1 judge
braintrust --no-judge "React vs Vue"            # 只并发收集，不 judge
braintrust --judge-model gemini "数据库选型"    # 切换 Judge 模型
braintrust --skip codex "量子计算"              # 跳过某个模型（可多次）
braintrust --with cursor --with kimi "代码评审" # 显式增加可选 provider
cat app.ts | braintrust "review 这段代码"       # stdin 管道
braintrust --dir ~/project "项目分析"           # 指定工作目录
braintrust --context-file design.md "实现方案"  # 附加上下文文件
braintrust --timeout 60 "快速问题"              # 超时秒数
braintrust --no-save "临时问答"                 # 不保存到磁盘
braintrust --json "问题"                        # 输出完整 JSON
braintrust --list                                # 查看历史运行
braintrust --strict "关键决策"                   # [v2] 完整 Judge 流水线
```

### 参数一览

| 参数 | 默认 | 说明 |
|------|------|------|
| `"prompt"` | 必须 | 问题文本 |
| `--skip <model>` | — | 跳过已选模型，可多次使用 |
| `--with <provider>` | — | 显式加入可选 provider：cursor / kimi / deepseek / grok，可多次使用 |
| `--judge-model <model>` | `claude` | Judge 使用任一已注册 provider |
| `--no-judge` | false | 关闭 Judge，只展示各模型原始回答 |
| `--timeout <sec>` | `120` | 每个模型的超时秒数 |
| `--dir <path>` | cwd | CLI 工具的工作目录 |
| `--context-file <file>` | — | 附加文件内容作为上下文（最多 8000 字符）|
| `--no-save` | false | 不保存结果到磁盘 |
| `--json` | false | 将完整结果以 JSON 格式输出到 stdout |
| `--list` | — | 列出最近 20 条历史运行 |
| `--strict` | — | [v2 占位] 两阶段 Judge + swap-compare |

---

## Provider 与认证

默认 provider 无需 `--with`；可选项只在显式加入时调用。密钥仅从当前进程环境读取，Braintrust 不保存或迁移 secrets。

| Provider | 启用方式 | 认证 / 前置条件 |
|----------|----------|-----------------|
| Claude / Codex / Gemini | 默认 | 对应 CLI 已登录（Gemini 使用 `agy`） |
| Cursor | `--with cursor` | Cursor CLI 已登录 |
| Kimi | `--with kimi` | `KIMI_API_KEY` |
| DeepSeek | `--with deepseek` | `DEEPSEEK_API_KEY` |
| Grok | `--with grok` | `XAI_API_KEY` |

MCP 的 `consult` 工具也接受 `with: ["cursor", "kimi"]`，与 CLI 的选择语义一致。
Kimi 的 Anthropic 兼容环境变量只注入其子进程；不要在 `~/.claude/settings.json` 写全局 Kimi `env`，否则该文件可能覆盖 shell 环境并影响普通 Claude 调用。
默认 Kimi 模型为 `k3-256k`，需要 Moderato+；Andante 用户可设置 `BRAINTRUST_KIMI_MODEL=kimi-for-coding`。

---

## 输出

**终端**：各模型回答 + Judge 融合报告（Markdown 格式）

**落盘**（`~/ai-outputs/<timestamp>/`）：

```
~/ai-outputs/2026-04-09T11-23-45-678/
├── raw/
│   ├── claude.txt
│   ├── codex.txt
│   └── gemini.txt
├── normalized.json    # 已选模型的结构化摘要
└── report.md          # 最终融合报告
```

---

## 架构

```
runGenerators()         # 并发调用已选 provider，AbortController 超时，Promise.allSettled 容错
normalizeResults()      # 各适配器提取 content / key_claims / assumptions / risks
runSimpleJudge()        # 单次 Judge 调用，只传归一化摘要（非全文），控制 token
writeRunArtifacts()     # 落盘 raw/ + normalized.json + report.md
runFullJudgePipeline()  # [v2 占位] 两阶段 Judge + swap-compare + 抗偏置
```

**Judge prompt 匿名化**：候选标签只用 A / B / C，不暴露 provider 名称，避免模型偏置。

---

## 成本估算

默认每次运行 = 3 个 generator + 1 个 Judge；每个 `--with` provider 会增加一次 generator 调用：

| 问题复杂度 | 估算成本 |
|-----------|---------|
| 简单 | $0.20 – 0.50 |
| 中等 | $0.50 – 1.00 |
| 复杂 | $1.00 – 2.00 |

---

## V2 路线图

1. `--strict`：两阶段 Judge (A+B) + swap-compare + 抗偏置
2. `--continue`：线程续聊
3. `--context-file` 智能截断 + git diff 注入
4. 成本 / token 预算控制器
5. 更多 provider（Goose、本地模型等）
