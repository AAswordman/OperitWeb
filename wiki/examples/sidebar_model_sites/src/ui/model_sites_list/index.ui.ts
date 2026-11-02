import type { ComposeDslContext, ComposeNode } from "../../../../types/compose-dsl";
import {
  MODEL_SITES_ENV_KEY,
  MODEL_SITES_VIEWER_ROUTE,
  getModelSitesByCategory,
  type ModelSiteEntry,
} from "../../shared/site_catalog.js";

function renderSiteCard(
  ctx: ComposeDslContext,
  site: ModelSiteEntry
): ComposeNode {
  const { UI } = ctx;
  const colors = ctx.MaterialTheme.colorScheme;

  const subtitle = [site.provider, site.requiresLogin ? "需登录" : "直达"]
    .filter(Boolean)
    .join(" · ");
  const tagLine = site.tags.slice(0, 3).join(" · ");
  const logoText = site.shortName || site.name.slice(0, 1).toUpperCase();

  return UI.Card(
    {
      key: site.id,
      fillMaxWidth: true,
      containerColor: colors.surface,
      elevation: 1,
      modifier: ctx.Modifier.fillMaxWidth().clickable(async () => {
        console.log(
          `[sidebar_model_sites] list card clicked: siteId=${site.id}, route=${MODEL_SITES_VIEWER_ROUTE}`
        );
        console.log(
          `[sidebar_model_sites] setEnv begin: key=${MODEL_SITES_ENV_KEY}, value=${site.id}`
        );
        await Promise.resolve(ctx.setEnv(MODEL_SITES_ENV_KEY, site.id));
        console.log(
          `[sidebar_model_sites] setEnv done: key=${MODEL_SITES_ENV_KEY}, value=${site.id}`
        );
        console.log(
          `[sidebar_model_sites] navigate begin: route=${MODEL_SITES_VIEWER_ROUTE}`
        );
        await Promise.resolve(ctx.navigate(MODEL_SITES_VIEWER_ROUTE));
        console.log(
          `[sidebar_model_sites] navigate done: route=${MODEL_SITES_VIEWER_ROUTE}`
        );
      }),
    },
    UI.Column(
      {
        fillMaxWidth: true,
        padding: 12,
        spacing: 8,
      },
      [
        UI.Row(
          {
            fillMaxWidth: true,
            verticalAlignment: "center",
            spacing: 10,
          },
          [
            UI.Box(
              {
                width: 34,
                height: 34,
                contentAlignment: "center",
                modifier: ctx.Modifier
                  .background(colors.primaryContainer, { cornerRadius: 10 })
                  .border(1, colors.outlineVariant.copy({ alpha: 0.2 }), {
                    cornerRadius: 10,
                  }),
              },
              UI.Text({
                text: logoText,
                style: "labelLarge",
                color: colors.onPrimaryContainer,
                maxLines: 1,
                overflow: "ellipsis",
              })
            ),
            UI.Column(
              {
                weight: 1,
                spacing: 2,
              },
              [
                UI.Text({
                  text: site.name,
                  style: "titleMedium",
                  color: colors.onSurface,
                  maxLines: 1,
                  overflow: "ellipsis",
                }),
                UI.Text({
                  text: subtitle,
                  style: "labelMedium",
                  color: colors.primary,
                  maxLines: 1,
                  overflow: "ellipsis",
                }),
              ]
            ),
            UI.Icon({
              name: "open_in_new",
              tint: colors.onSurfaceVariant,
              size: 18,
            }),
          ]
        ),
        UI.Text({
          text: tagLine,
          style: "labelSmall",
          color: colors.secondary,
          maxLines: 1,
          overflow: "ellipsis",
        }),
      ]
    )
  );
}

function renderSection(
  ctx: ComposeDslContext,
  title: string,
  sites: ModelSiteEntry[]
): ComposeNode[] {
  const { UI } = ctx;
  const colors = ctx.MaterialTheme.colorScheme;
  const nodes: ComposeNode[] = [
    UI.Text({
      text: title,
      style: "titleLarge",
      color: colors.onSurface,
    }),
  ];

  sites.forEach((site) => {
    nodes.push(renderSiteCard(ctx, site));
  });

  return nodes;
}

export default function Screen(ctx: ComposeDslContext): ComposeNode {
  const { UI } = ctx;
  const colors = ctx.MaterialTheme.colorScheme;
  const domesticSites = getModelSitesByCategory("domestic");
  const globalSites = getModelSitesByCategory("global");

  return UI.LazyColumn(
    {
      fillMaxSize: true,
      padding: 14,
      spacing: 10,
    },
    [
      ...renderSection(ctx, "国内站点", domesticSites),
      ...renderSection(ctx, "国际站点", globalSites),
    ]
  );
}
