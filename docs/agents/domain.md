# 领域文档

工程技能探索代码库时，应当怎样使用本仓库的领域文档。

## 探索之前先读这些

- 根目录的 **`GLOSSARY.md`**；如果根目录有 **`GLOSSARY-MAP.md`**，读它：它指向每个上下文各一份 `GLOSSARY.md`，把你这次话题涉及的每一份都读了。
- **`docs/adr/`**：读与你要动的区域相关的 ADR。多上下文仓库里，还要看 `src/<context>/docs/adr/` 下与上下文相关的决策。

这些文件不存在就**安静继续**。不要指出它们缺失，也不要一上来就建议创建。`/domain-modeling` 技能（从 `/grill-with-docs` 和 `/improve-codebase-architecture` 进入）会在术语或决策真正定下来时按需创建。

## 文件结构

单上下文仓库（大多数仓库）：

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录有 `GLOSSARY-MAP.md`）：

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← 全系统范围的决策
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← 某个上下文自己的决策
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## 沿用术语表的词汇

输出里要提到某个领域概念时（issue 标题、重构提案、假设、测试名），按 `GLOSSARY.md` 里的定义来写。不要漂到术语表明确避开的同义词。

你需要用的概念还没进术语表，这本身是个信号：要么你在造项目不用的词（重新想想），要么是术语表真有缺口（记下来交给 `/domain-modeling`）。

## 标出 ADR 冲突

输出与现有 ADR 相矛盾时，明确说出来，不要悄悄覆盖：

> _与 ADR-0007（event-sourced orders）矛盾，但值得重开，因为……_
