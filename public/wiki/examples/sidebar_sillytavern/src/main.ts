import sillyTavernDashboardScreen from "./ui/sillytavern_dashboard/index.ui.js";

const SILLYTAVERN_ROUTE = "toolpkg:com.operit.sidebar_sillytavern:ui:sillytavern_dashboard";

export function registerToolPkg(): boolean {
  ToolPkg.registerUiRoute({
    id: "sillytavern_dashboard",
    route: SILLYTAVERN_ROUTE,
    runtime: "compose_dsl",
    screen: sillyTavernDashboardScreen,
    params: {},
    keepAlive: true,
    title: {
      zh: "酒馆",
      en: "SillyTavern",
    },
  });

  ToolPkg.registerNavigationEntry({
    id: "sillytavern_dashboard_sidebar",
    route: SILLYTAVERN_ROUTE,
    surface: "main_sidebar_plugins",
    title: {
      zh: "酒馆",
      en: "SillyTavern",
    },
    icon: Icons.Chat,
    order: 122,
  });

  return true;
}
