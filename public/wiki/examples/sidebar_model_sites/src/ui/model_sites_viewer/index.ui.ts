import type { ComposeDslContext, ComposeNode } from "../../../../types/compose-dsl";
import {
  MODEL_SITES_ENV_KEY,
  MODEL_SITES_LIST_ROUTE,
  getModelSiteById,
} from "../../shared/site_catalog.js";

export default function Screen(ctx: ComposeDslContext): ComposeNode {
  const { UI } = ctx;
  const colors = ctx.MaterialTheme.colorScheme;
  const selectedSiteId = String(ctx.getEnv(MODEL_SITES_ENV_KEY) || "").trim();
  const selectedSite = getModelSiteById(selectedSiteId);
  console.log(
    `[sidebar_model_sites] viewer render: selectedSiteId=${selectedSiteId || "<empty>"}, found=${selectedSite ? "yes" : "no"}`
  );

  const [pageLoading, setPageLoading] = ctx.useState("pageLoading", true);
  const [pageProgress, setPageProgress] = ctx.useState("pageProgress", 0);
  const [errorText, setErrorText] = ctx.useState("errorText", "");
  const [statusDetail, setStatusDetail] = ctx.useState(
    "statusDetail",
    "正在准备打开站点"
  );
  const [reloadToken, setReloadToken] = ctx.useState("reloadToken", "0");

  function clampProgress(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  if (!selectedSite) {
    return UI.Box(
      {
        fillMaxSize: true,
        contentAlignment: "center",
      },
      UI.Column(
        {
          width: 280,
          spacing: 12,
          horizontalAlignment: "center",
        },
        [
          UI.Text({
            text: "还没有选中要打开的网站",
            style: "titleMedium",
            color: colors.onSurface,
          }),
          UI.Text({
            text: "请先回到“网站聚合”列表页，再点一个站点进入这里。",
            style: "bodyMedium",
            color: colors.onSurfaceVariant,
            maxLines: 3,
            overflow: "ellipsis",
          }),
          UI.Button(
            {
              onClick: async () => {
                await Promise.resolve(ctx.navigate(MODEL_SITES_LIST_ROUTE));
              },
            },
            UI.Text({
              text: "返回列表",
            })
          ),
        ]
      )
    );
  }

  const progressValue = clampProgress(pageProgress);
  const overlayVisible = Boolean(errorText) || pageLoading;

  const loadingOverlay = UI.Box(
    {
      fillMaxSize: true,
      zIndex: 1,
      backgroundBrush: {
        type: "verticalGradient",
        colors: [
          colors.surface.copy({ alpha: 0.96 }),
          colors.surface.copy({ alpha: 0.96 }),
        ],
      },
    },
    UI.Column(
      {
        fillMaxSize: true,
        paddingHorizontal: 24,
        spacing: 14,
        horizontalAlignment: "center",
        verticalArrangement: "center",
      },
      [
        UI.Icon({
          name: errorText ? "error" : "language",
          size: 34,
          tint: errorText ? colors.error : colors.primary,
          spin: !errorText,
          spinDurationMs: 850,
        }),
        !errorText
          ? UI.Column(
              {
                width: 220,
                spacing: 8,
                horizontalAlignment: "center",
              },
              [
                UI.Text({
                  text: `${progressValue}%`,
                  style: "labelMedium",
                  color: colors.primary,
                  maxLines: 1,
                  overflow: "ellipsis",
                }),
                UI.LinearProgressIndicator({
                  width: 220,
                  progress: progressValue / 100,
                }),
              ]
            )
          : UI.Spacer({ height: 0 }),
        UI.Text({
          text: errorText || statusDetail,
          style: "bodyMedium",
          color: errorText ? colors.error : colors.onSurfaceVariant,
          maxLines: 2,
          overflow: "ellipsis",
        }),
      ]
    )
  );

  return UI.Box(
    {
      fillMaxSize: true,
      topBarTitle: UI.Text({
        text: selectedSite.name,
        maxLines: 1,
        overflow: "ellipsis",
      }),
      onLoad: () => {
        console.log(
          `[sidebar_model_sites] viewer onLoad: site=${selectedSite.name}, url=${selectedSite.url}`
        );
        setReloadToken(String(Date.now()));
        setPageLoading(true);
        setPageProgress(4);
        setErrorText("");
        setStatusDetail(`正在打开 ${selectedSite.name}`);
      },
    },
    [
      UI.WebView({
        key: `model_sites_webview_${selectedSite.id}_${reloadToken}`,
        fillMaxSize: true,
        url: selectedSite.url,
        javaScriptEnabled: true,
        domStorageEnabled: true,
        allowFileAccess: true,
        allowContentAccess: true,
        supportZoom: false,
        useWideViewPort: true,
        loadWithOverviewMode: true,
        onPageStarted: () => {
          console.log(
            `[sidebar_model_sites] webview onPageStarted: site=${selectedSite.name}`
          );
          setPageLoading(true);
          setPageProgress(12);
          setStatusDetail(`正在连接 ${selectedSite.name}`);
        },
        onProgressChanged: (event) => {
          const nextProgress = clampProgress(Number(event?.progress ?? 0));
          console.log(
            `[sidebar_model_sites] webview onProgressChanged: site=${selectedSite.name}, progress=${nextProgress}`
          );
          setPageProgress(nextProgress > 0 ? nextProgress : 18);
          setStatusDetail(
            nextProgress > 0
              ? `${selectedSite.name} 页面加载中`
              : `正在建立 ${selectedSite.name} 页面连接`
          );
        },
        onPageFinished: () => {
          console.log(
            `[sidebar_model_sites] webview onPageFinished: site=${selectedSite.name}`
          );
          setPageProgress(100);
          setStatusDetail(`${selectedSite.name} 已打开`);
          setPageLoading(false);
        },
        onReceivedError: (event) => {
          console.log(
            `[sidebar_model_sites] webview onReceivedError: site=${selectedSite.name}, payload=${JSON.stringify(event ?? {})}`
          );
        },
      }),
      overlayVisible ? loadingOverlay : UI.Spacer({ height: 0 }),
    ]
  );
}
