# Issue 跟踪与分诊标签

本仓库的 issue 和 Spec 统一存为 GitHub issue（`nonhana/campanula-music`），操作全部走 `gh` CLI。新建 Spec 或任务票前另读 [issue-template.md](./issue-template.md)。

## 分诊标签

| 标签              | 含义                                       |
| ----------------- | ------------------------------------------ |
| `needs-triage`    | 维护者需要评估                             |
| `needs-info`      | 等报告者补充信息                           |
| `ready-for-agent` | 已完整描述，可交给 agent 无人值守实现      |
| `ready-for-human` | 需要人亲手完成（真机、真账号、外部服务等） |
| `wontfix`         | 不会处理                                   |

**PRs as a request surface: no.**（外部 PR 不作分诊入口；若后续改为 `yes`，PR 沿用同一套标签并改用对应 `gh pr` 命令。GitHub issue 与 PR 共用编号，单独 `#N` 可先试 `gh pr view N` 再回退 `gh issue view N`。）

## 常用 `gh` 命令

- **新建 issue**：`gh issue create --title "..." --label ready-for-agent --body-file <正文文件>`（先写临时文件避免 shell 展开反引号和 `$`）
- **读 issue 正文**：`gh issue view <n> --json title,body,labels --jq '"# \(.title)\nlabels: \([.labels[].name] | join(", "))\n\n\(.body)"'`
- **读 issue 评论**：`gh issue view <n> --json comments --jq '.comments[] | "## \(.author.login) \(.createdAt)\n\(.body)\n"'`（非终端环境下 `gh issue view --comments` 只输出评论、不输出正文）
- **列 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`
- **评论 / 标签 / 关闭**：`gh issue comment <n> --body "..."`、`gh issue edit <n> --add-label "..."` / `--remove-label "..."`、`gh issue close <n> --comment "..."`

## 子票与阻塞关系

- **挂到父 Spec（sub-issue）**：
  ```sh
  gh api --method POST repos/nonhana/campanula-music/issues/<Spec号>/sub_issues \
    -F sub_issue_id="$(gh api repos/nonhana/campanula-music/issues/<票号> --jq .id)"
  ```
- **加阻塞依赖（native issue dependencies）**：
  ```sh
  gh api --method POST repos/nonhana/campanula-music/issues/<被阻塞票号>/dependencies/blocked_by \
    -F issue_id="$(gh api repos/nonhana/campanula-music/issues/<阻塞者票号> --jq .id)"
  ```
  注意必须传数值 **database id**（`.id`），不是 `#number` 或 `node_id`。原生依赖不可用时退回在正文顶部写 `Blocked by: #<n>`。
- **探路（wayfinding）约定**：地图用 `wayfinder:map` label；子票用 `wayfinder:<research|prototype|grilling|task>`；前沿查询过滤掉仍有未关闭阻塞者或已指派人的子票；认领执行 `gh issue edit <n> --add-assignee @me`；解决后评论结论、关闭并在地图“当前决策”追加指针。
