import bookkeepingDashboardScreen from "./ui/bookkeeping_dashboard/index.ui.js";

const ACCOUNT_BOOK_ROUTE = "toolpkg:com.operit.sidebar_account_book:ui:bookkeeping_dashboard";

export function registerToolPkg(): boolean {
  ToolPkg.registerUiRoute({
    id: "bookkeeping_dashboard",
    route: ACCOUNT_BOOK_ROUTE,
    runtime: "compose_dsl",
    screen: bookkeepingDashboardScreen,
    params: {},
    title: {
      zh: "记账本",
      en: "Account Book",
    },
  });

  ToolPkg.registerNavigationEntry({
    id: "bookkeeping_dashboard_sidebar",
    route: ACCOUNT_BOOK_ROUTE,
    surface: "main_sidebar_plugins",
    title: {
      zh: "记账本",
      en: "Account Book",
    },
    icon: Icons.Book,
    order: 120,
  });

  return true;
}
