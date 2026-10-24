# Issue 跟踪：GitHub

本仓库的 issue 和 Spec 都存成 GitHub issue。所有操作都用 `gh` CLI。

## 约定

- **新建 issue**：`gh issue create --title "..." --body "..."`。正文多行时用 heredoc。
- **读 issue**：`gh issue view <number> --comments`，用 `jq` 过滤评论，并同时取 label。
- **列 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，按需加 `--label`、`--state` 过滤。
- **在 issue 下评论**：`gh issue comment <number> --body "..."`
- **加 / 去 label**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：`gh issue close <number> --comment "..."`

仓库从 `git remote -v` 推断；在克隆目录里运行时 `gh` 会自动做这件事。

## PR 是否作为分诊入口

**PRs as a request surface: no.**（本仓库若把外部 PR 当功能请求，就改成 `yes`；`/triage` 会读这个标记。）

改成 `yes` 后，PR 与 issue 走同一套 label 和状态，命令换成对应的 `gh pr`：

- **读 PR**：`gh pr view <number> --comments`，看 diff 用 `gh pr diff <number>`。
- **列出待分诊的外部 PR**：`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，只保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的（去掉 `OWNER`/`MEMBER`/`COLLABORATOR`）。
- **评论 / 加 label / 关闭**：`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的 issue 和 PR 共用一套编号，所以单独一个 `#42` 可能是其中任意一种：先用 `gh pr view 42` 判断，再回退到 `gh issue view 42`。

## 技能说“把结果发布到 issue 跟踪器”时

新建一个 GitHub issue。

## 技能说“取出相关票”时

运行 `gh issue view <number> --comments`。

## 探路（wayfinding）操作

供 `/wayfinder` 使用。**地图（map）** 是一张 issue，**子票（child issue）** 是挂在它下面的票。

- **地图**：一张打了 `wayfinder:map` label 的 issue，正文写笔记（Notes）、当前决策（Decisions-so-far）和迷雾（Fog，还没定下来的未知）。`gh issue create --label wayfinder:map`。
- **子票**：通过 GitHub sub-issue 挂到地图上的 issue（用 `gh api` 调 sub-issues 端点）。不支持 sub-issue 时，把子票加进地图正文的任务列表，并在子票正文顶部写 `Part of #<map>`。label 用 `wayfinder:<type>`（`research`/`prototype`/`grilling`/`task`）。认领后，这张票会指派给负责推进的开发者。
- **阻塞**：用 GitHub 原生的 issue 依赖关系（native issue dependencies），这是标准且在界面上可见的表示。加一条边：`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`，其中 `<blocker-db-id>` 是阻塞者 issue 的数值 **database id**（用 `gh api repos/<owner>/<repo>/issues/<n> --jq .id` 取，_不是_ `#number`，也不是 `node_id`）。GitHub 通过 `issue_dependencies_summary.blocked_by` 报告尚未关闭的阻塞者（只算打开的，这是实时闸门）。不能用依赖关系时，退回到在子票正文顶部写 `Blocked by: #<n>, #<n>`。所有阻塞者都关闭后，这张票才算解除阻塞。
- **前沿查询（frontier）**：列出地图下所有打开的子 issue（`gh issue list --state open`，范围限定在地图的 sub-issue / 任务列表），去掉有未关闭阻塞者的（`issue_dependencies_summary.blocked_by > 0`，或 `Blocked by` 行里还有打开的 issue）和已经指派了人的；然后取地图顺序里的第一张。
- **认领**：`gh issue edit <n> --add-assignee @me`，这是本轮会话的第一次写入。
- **解决**：先 `gh issue comment <n> --body "<answer>"`，再 `gh issue close <n>`，最后往地图的“当前决策”里追加一条上下文指针（要点 + 链接）。
