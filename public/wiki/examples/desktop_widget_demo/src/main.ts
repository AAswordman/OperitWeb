import widgetDemoScreen from "./ui/widget_demo/index.ui.js";
import widgetRenderScreen from "./ui/widget_demo/widget.ui.js";

const WIDGET_DEMO_ROUTE =
  "toolpkg:com.operit.desktop_widget_demo:ui:today_hub";
const WIDGET_DEMO_RENDER_ROUTE =
  "toolpkg:com.operit.desktop_widget_demo:ui:today_hub_widget";

export function registerToolPkg(): boolean {
  ToolPkg.registerUiRoute({
    id: "today_hub",
    route: WIDGET_DEMO_ROUTE,
    runtime: "compose_dsl",
    screen: widgetDemoScreen,
    params: {},
    title: {
      zh: "今日面板",
      en: "Today Hub",
    },
  });

  ToolPkg.registerUiRoute({
    id: "today_hub_widget",
    route: WIDGET_DEMO_RENDER_ROUTE,
    runtime: "compose_dsl",
    screen: widgetRenderScreen,
    params: {},
    title: {
      zh: "今日面板小组件",
      en: "Today Hub Widget",
    },
  });

  ToolPkg.registerDesktopWidget({
    id: "today_hub_home",
    route: WIDGET_DEMO_ROUTE,
    render: WIDGET_DEMO_RENDER_ROUTE,
    title: {
      zh: "今日面板",
      en: "Today Hub",
    },
    subtitle: {
      zh: "查看今天的重点与节奏",
      en: "See today's focus and pace",
    },
    description: {
      zh: "一个更接近真实使用场景的小组件示例：桌面展示摘要，点击进入完整页面。",
      en: "A more realistic widget example: summary on the home screen, full page on tap.",
    },
    icon: Icons.Widgets,
    order: 10,
  });

  return true;
}
