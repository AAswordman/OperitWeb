"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Screen;
function buildWidgetModel() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes().toString().padStart(2, "0");
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
    const greeting = hour < 6 ? "夜深了" : hour < 12 ? "早安" : hour < 18 ? "午后继续" : "晚上收尾";
    const progress = Math.max(8, Math.min(96, Math.round((hour / 24) * 100)));
    const focus = hour < 12 ? "先做最重要的事" : hour < 18 ? "继续推进主线" : "处理尾项并放松";
    return {
        dateText: `${month}月${day}日 ${weekday}`,
        timeText: `${hour}:${minute}`,
        greeting,
        progress,
        focus,
    };
}
function Screen(ctx) {
    const { UI } = ctx;
    const colors = ctx.MaterialTheme.colorScheme;
    const model = buildWidgetModel();
    return UI.Column({
        fillMaxSize: true,
        padding: 12,
        spacing: 8,
    }, [
        UI.Text({
            text: model.dateText,
            style: "titleMedium",
            color: colors.onSurface,
        }),
        UI.Text({
            text: `${model.greeting} · ${model.timeText}`,
            style: "headlineSmall",
            color: colors.onSurface,
        }),
        UI.Text({
            text: model.focus,
            style: "bodySmall",
            color: colors.onSurfaceVariant,
        }),
        UI.LinearProgressIndicator({
            fillMaxWidth: true,
            progress: model.progress / 100,
        }),
        UI.Text({
            text: `今日进度 ${model.progress}%`,
            style: "labelMedium",
            color: colors.primary,
        }),
        UI.Button({
            text: "打开今日面板",
            fillMaxWidth: true,
            onClick: () => { },
        }),
    ]);
}
