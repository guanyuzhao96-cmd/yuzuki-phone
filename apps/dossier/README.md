# 只读角色档案

入口：手机桌面应用区 → 角色档案。自动读取当前角色主世界书、额外绑定世界书、聊天世界书和全局启用世界书，发现其中的 CWB 目录并按完整姓名关联同一本世界书中的静态、动态条目。无需手动选择世界书；“来源”仅显示目录索引和检查状态。旧版手动选择不再参与读取，未关联世界书不会被扫描。

支持 CWB 目录的 `姓名: "完整姓名"` 格式；静态角色条目的顶层中文字段，以及动态档案的 `[字段.序号]:内容` 格式。按世界书与完整姓名区分角色，多个候选来源需要手动选择；尚未提供资料的目录角色仍列出。停用的条目可作为只读资料查看，并标明停用状态。原文以转义文本展示，绝不执行 HTML 或指令。

MVU 优先通过酒馆助手 `Mvu.getMvuData({type:'message', message_id:'latest'})` 读取最新消息；接口不可用时，回退到当前聊天最近一条带 `stat_data` 的消息。只读 `stat_data.roles`，按角色档案完整姓名匹配角色对象的 `role_name`，其次允许 MVU 角色 ID 与完整姓名完全相同；多条匹配或近似名称均不自动绑定。自动展示 `grade`、`relationship`、`affection`、`romanceStatus`、`approachStage`、`approachEvidence`、`currentGoal`、`goalProgress`、`currentMoodOrDesire`、`shortTermGoal`、`longTermGoal` 和 `quests`；缺失、空值或 `null` 显示“未记录”，数值 0 和布尔值照原样显示。其他字段仍可用自定义 JSON Pointer 展示。插件不会调用 MVU 更新接口，也不会写入角色数据。

当前应用打开时读取，消息相关事件后延迟读取，前台每 20 秒重新核对当前绑定的世界书与目录；回到桌面或打开其他应用停止定时器，后台标签与关闭的手机面板不读取。手动刷新直接读取服务端已保存世界书。异步结果校验聊天身份及请求序号，切换聊天后舍弃旧结果。未保存到世界书编辑器的数据无法从服务端读取。

不调用 AI；不改写源文，不合计可能重叠的人数，不从设定发展路径推断已发生剧情。普通展示按分句过滤明显系统/任务信息，原文仍可核对；复杂语义审查应由资料生成端处理。静态初始设定、动态剧情与已映射的 MVU 分区显示，避免无依据覆盖。

仅 `chat_dossier_preferences` 保存同类来源选择与 MVU 展示映射，沿用 PhoneStorage 的聊天元数据存储；角色正文与自动发现的目录只存在内存。刷新时间代表读取时间，不代表剧情已经总结到最新楼层。

验证：`node --test tests/dossier.test.mjs tests/phone-swipe-back-routing.test.mjs tests/worldbook-macros.test.mjs`。酒馆中的实际事件及 MVU 兼容性需在目标安装环境再次核对。
