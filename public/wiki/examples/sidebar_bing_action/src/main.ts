const BING_URL = "https://www.bing.com";

export function registerToolPkg(): boolean {
  ToolPkg.registerNavigationEntry({
    id: "open_bing_with_action",
    surface: "main_sidebar_plugins",
    title: {
      zh: "打开 Bing",
      en: "Open Bing",
    },
    icon: Icons.Language,
    order: 100,
    action: openBingFromSidebar,
  });

  return true;
}

export async function openBingFromSidebar(
  event: ToolPkg.NavigationEntryActionHookEvent
): Promise<ToolPkg.JsonObject> {
  await toolCall("browser_navigate", {
    url: BING_URL,
  });

  return {
    ok: true,
    openedUrl: BING_URL,
    sourceEntryId: String(event.eventPayload.entryId ?? ""),
  };
}
