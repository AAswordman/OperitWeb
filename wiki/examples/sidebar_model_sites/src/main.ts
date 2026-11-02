import modelSitesListScreen from "./ui/model_sites_list/index.ui.js";
import modelSitesViewerScreen from "./ui/model_sites_viewer/index.ui.js";
import {
  MODEL_SITES_LIST_ROUTE,
  MODEL_SITES_VIEWER_ROUTE,
} from "./shared/site_catalog.js";

export function registerToolPkg(): boolean {
  ToolPkg.registerUiRoute({
    id: "model_sites_list",
    route: MODEL_SITES_LIST_ROUTE,
    runtime: "compose_dsl",
    screen: modelSitesListScreen,
    params: {},
    title: {
      zh: "网站聚合",
      en: "Model Sites",
    },
  });

  ToolPkg.registerUiRoute({
    id: "model_sites_viewer",
    route: MODEL_SITES_VIEWER_ROUTE,
    runtime: "compose_dsl",
    screen: modelSitesViewerScreen,
    params: {},
    title: {
      zh: "站点浏览",
      en: "Site Viewer",
    },
  });

  ToolPkg.registerNavigationEntry({
    id: "model_sites_sidebar",
    route: MODEL_SITES_LIST_ROUTE,
    surface: "main_sidebar_plugins",
    title: {
      zh: "网站聚合",
      en: "Model Sites",
    },
    icon: Icons.Language,
    order: 136,
  });

  return true;
}
