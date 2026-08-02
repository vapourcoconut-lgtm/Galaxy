# IELTS Speaking Knowledge Base 数据库设计

## 设计原则

1. 原始答案不可被 AI 结果覆盖。
2. Part 1 / Part 2 / Part 3 共享题目主表，差异字段放在独立扩展表。
3. 表达、标签、标注、复习记录独立建模，便于跨题目复用与统计。
4. AI 生成内容保留来源版本、模型和生成时间，支持回溯。

## 核心关系

```text
users
  └── speaking_topics
        └── speaking_questions
              ├── answer_versions
              ├── question_tags
              ├── text_annotations
              ├── question_notes
              ├── review_records
              └── story_question_links

answer_versions
  └── extracted_expressions
        └── expression_topic_links

personal_stories
  └── story_question_links
```

## 表结构

### speaking_topics

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| user_id | uuid | 所属用户 |
| part | smallint | 1 / 2 / 3 |
| title | varchar(120) | 话题名称 |
| description | text | 话题说明 |
| color | varchar(20) | 展示色 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

唯一约束：`(user_id, part, lower(title))`

### speaking_questions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| topic_id | uuid | 所属话题 |
| part | smallint | 冗余字段，便于查询 |
| question_text | text | Part 1/3 问题或 Part 2 Cue Card |
| story_material | text | Part 2 我的故事素材 |
| my_opinion | text | Part 3 核心观点 |
| supporting_examples | text | Part 3 支撑案例 |
| related_part3_questions | jsonb | Part 2 相关 Part 3 问题 |
| keywords | text[] | 关键词 |
| review_status | varchar(20) | not_started / learning / mastered |
| last_review_at | timestamptz | 最近复习时间 |
| next_review_at | timestamptz | 下次复习时间 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### answer_versions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| question_id | uuid | 所属问题 |
| version_type | varchar(20) | original / ai_improved / final |
| content_html | text | 支持高亮的答案 HTML |
| plain_text | text | 搜索与 AI 分析使用 |
| revision | integer | 修订号 |
| is_current | boolean | 当前版本 |
| ai_model | varchar(80) | AI 版本记录 |
| generation_prompt | text | 生成提示词摘要 |
| created_at | timestamptz | 创建时间 |

约束：同一问题、同一类型只允许一个 `is_current = true`。

### extracted_expressions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| answer_version_id | uuid | 来源答案 |
| expression | varchar(240) | 表达 |
| meaning | text | 英文或中文释义 |
| example | text | 示例 |
| expression_type | varchar(30) | vocabulary / collocation / pattern |
| suitable_topics | text[] | 可迁移话题 |
| mastery_status | varchar(20) | learning / mastered |
| is_reusable | boolean | 是否进入个人表达库 |

### personal_stories

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| user_id | uuid | 所属用户 |
| title | varchar(160) | 素材标题 |
| story_content | text | 故事内容 |
| keywords | text[] | 关键词 |
| reusable_angles | text[] | 可复用角度 |
| created_at | timestamptz | 创建时间 |

### story_question_links

| 字段 | 类型 | 说明 |
|---|---|---|
| story_id | uuid | 素材 |
| question_id | uuid | 可复用问题 |
| fit_score | numeric(4,3) | AI 推荐匹配度 |
| usage_note | text | 如何迁移 |

### tags / question_tags

`tags` 保存用户级标签；`question_tags` 为问题与标签的多对多关系。

### text_annotations

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| answer_version_id | uuid | 所属答案版本 |
| start_offset | integer | 纯文本起点 |
| end_offset | integer | 纯文本终点 |
| selected_text | text | 被标记文本 |
| color | varchar(12) | yellow / blue / red / green |
| comment | text | 批注 |
| created_at | timestamptz | 创建时间 |

生产环境建议使用文本锚点与上下文哈希辅助定位，避免编辑后偏移失效。

### question_notes

保存问题级备注；可增加 `note_type` 区分考试提醒、迁移建议和普通笔记。

### review_records

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键 |
| question_id | uuid | 复习问题 |
| practiced_at | timestamptz | 练习时间 |
| estimated_band | numeric(2,1) | 预估分数 |
| fluency_score | numeric(2,1) | 流利度 |
| lexical_score | numeric(2,1) | 词汇 |
| grammar_score | numeric(2,1) | 语法 |
| pronunciation_score | numeric(2,1) | 发音 |
| weak_points | jsonb | 薄弱项 |
| interval_days | integer | 当前复习间隔 |

## 页面结构

```text
IELTS Speaking Knowledge Base
├── Overview
│   ├── Part 1 / 2 / 3 数量
│   ├── 今日复习
│   └── 最近编辑
├── Part 1
│   ├── Topic 列表
│   ├── Question 列表
│   └── Question Editor
├── Part 2
│   ├── Cue Card 列表
│   ├── Story Material
│   └── Reusable Material
├── Part 3
│   ├── Topic / Question
│   ├── Opinion / Supporting Examples
│   └── Advanced Expressions
└── Expression Bank
    ├── Vocabulary
    ├── Sentence Patterns
    └── Topic / Mastery 筛选
```

## API 边界建议

- `POST /topics`
- `POST /questions`
- `PATCH /questions/:id`
- `POST /questions/:id/answers`
- `POST /questions/:id/ai-improve`
- `POST /questions/:id/extract-expressions`
- `POST /answers/:id/annotations`
- `POST /questions/:id/reviews`
- `GET /review/today`
- `GET /analytics/speaking`

AI 调用必须在服务端完成，不在浏览器保存模型密钥。

