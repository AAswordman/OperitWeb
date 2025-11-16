# Deep Search

Deep Search mode, when enabled, is triggered by specific keywords. It generates a task graph and calls multiple sub-agents to complete tasks in parallel, then summarizes the results. This mode consumes significant time and resources, and is generally not recommended for regular use.

## Feature Introduction

Deep Search mode uses a multi-agent collaboration approach to handle complex tasks:

1. **Task Graph Generation**: The system automatically generates a task decomposition graph based on your requirements
2. **Multi-Agent Parallel Processing**: Multiple sub-agents are called simultaneously to handle different subtasks
3. **Result Aggregation**: After all subtasks are completed, the system automatically summarizes and integrates the results

## Usage Instructions

### 1. Enable Deep Search

In the conversation settings menu, turn on the "Deep Search" switch to enable it.

![Deep Search Switch](/manuals/assets/chat/summary/89624e415e2ac0ed7a059a15d8bcd043.jpg)

### 2. Keyword Trigger

After enabling Deep Search, the system will automatically activate Deep Search mode when the conversation contains the following trigger words:

**Common Trigger Words:**

```
Analyze, compare, research, investigate, summarize, evaluate, plan, design, develop
Detailed, comprehensive, in-depth, systematic, integrated, multi-angle, steps, solution
Divide into several, multiple aspects, detailed explanation, specific analysis, how to implement, implementation plan
```

## Use Cases

Deep Search mode is suitable for the following scenarios:

- **Information Gathering**: Need to collect and organize information from multiple perspectives
- **Complex Analysis**: Need in-depth and comprehensive analysis of a topic
- **Solution Design**: Need to systematically design solutions or implementation plans
- **Comparative Research**: Need to compare multiple options or solutions

**Notes:**
- Deep Search consumes significant time and computational resources
- Recommended only when comprehensive, in-depth analysis is needed
- For simple questions, regular mode is sufficient