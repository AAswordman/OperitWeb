"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Screen;
function buildTodaySummary() {
    const now = new Date();
    const hour = now.getHours();
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const greeting = hour < 6 ? "凌晨模式" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
    const focus = hour < 12
        ? "优先推进最难的一件事"
        : hour < 18
            ? "把正在做的事情收口"
            : "清理尾项，给明天留空间";
    const progress = Math.max(0, Math.min(100, Math.round((hour / 24) * 100)));
    return {
        title: `${month}/${day} ${weekday}`,
        greeting,
        focus,
        progress,
    };
}
function infoCard(ctx, title, body) {
    const { UI } = ctx;
    const colors = ctx.MaterialTheme.colorScheme;
    return UI.Card({
        fillMaxWidth: true,
        containerColor: colors.surface,
        elevation: 1,
    }, UI.Column({
        fillMaxWidth: true,
        padding: 14,
        spacing: 6,
    }, [
        UI.Text({
            text: title,
            style: "titleMedium",
            color: colors.onSurface,
        }),
        UI.Text({
            text: body,
            style: "bodyMedium",
            color: colors.onSurfaceVariant,
        }),
    ]));
}
function Screen(ctx) {
    const { UI } = ctx;
    const colors = ctx.MaterialTheme.colorScheme;
    const summary = buildTodaySummary();
    return UI.LazyColumn({
        fillMaxSize: true,
        padding: 16,
        spacing: 12,
    }, [
        UI.Column({
            fillMaxWidth: true,
            spacing: 6,
        }, [
            UI.Text({
                text: "今日面板",
                style: "headlineMedium",
                color: colors.onSurface,
            }),
            UI.Text({
                text: "一个桌面小组件的真实示例：桌面展示轻摘要，点进来查看完整页面。",
                style: "bodyLarge",
                color: colors.onSurfaceVariant,
            }),
        ]),
        infoCard(ctx, "今天的状态", `${summary.title}\n${summary.greeting}\n当前节奏：${summary.progress}%`),
        infoCard(ctx, "现在更适合做什么", summary.focus),
        infoCard(ctx, "这个示例验证什么", "route 只负责点击后打开完整页面，render 单独负责桌面小组件的渲染来源。"),
        UI.Button({
            fillMaxWidth: true,
            text: "刷新这次渲染日志",
            onClick: () => {
                console.log(`[today_hub] render refreshed: date=${summary.title}, progress=${summary.progress}`);
            },
        }),
    ]);
}
