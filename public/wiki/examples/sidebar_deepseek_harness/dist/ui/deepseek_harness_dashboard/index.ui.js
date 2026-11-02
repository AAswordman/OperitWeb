"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Screen;
const deepseek_harness_web_runtime_js_1 = require("../../shared/deepseek_harness_web_runtime.js");
function clampProgress(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
function appendInstallationOutput(current, incoming) {
    const combined = current ? `${current}\n${incoming}` : incoming;
    return combined.slice(-12000);
}
function formatVisibleInstallationOutput(output) {
    const lines = output.split(/\r?\n/);
    if (lines.length <= 18) {
        return output;
    }
    return [...lines.slice(0, 5), "...", ...lines.slice(-12)].join("\n");
}
function formatStartupFailure(result) {
    if (result.diagnostic !== undefined && result.diagnostic.trim()) {
        return `${result.message}\n\n${result.diagnostic.trim()}`;
    }
    if (result.logTail !== undefined && result.logTail.trim()) {
        return `${result.message}\n\n${result.logTail.trim()}`;
    }
    return result.message;
}
function formatInstallFailure(result) {
    if (result.diagnostic !== undefined && result.diagnostic.trim()) {
        return `${result.message}\n\n${result.diagnostic.trim()}`;
    }
    return result.message;
}
function formatInstallExecution(result) {
    const details = [];
    if (result.executedCommand !== undefined && result.executedCommand.trim()) {
        details.push(`执行命令: ${result.executedCommand.trim()}`);
    }
    if (result.installExitCode !== undefined) {
        details.push(`退出码: ${result.installExitCode}`);
    }
    if (result.installTimedOut !== undefined) {
        details.push(`是否超时: ${result.installTimedOut ? "是" : "否"}`);
    }
    if (result.installOutput !== undefined && result.installOutput.trim()) {
        details.push(`原始输出:\n${result.installOutput.trim()}`);
    }
    return details.join("\n");
}
function Screen(ctx) {
    const { UI } = ctx;
    const colors = ctx.MaterialTheme.colorScheme;
    const [initialized, setInitialized] = ctx.useState("initialized", false);
    const [loading, setLoading] = ctx.useState("loading", false);
    const [serverUrl, setServerUrl] = ctx.useState("serverUrl", "");
    const [errorText, setErrorText] = ctx.useState("errorText", "");
    const [statusText, setStatusText] = ctx.useState("statusText", "正在检查 DeepSeek Harness");
    const [progress, setProgress] = ctx.useState("progress", 0);
    const [outputText, setOutputText] = ctx.useState("outputText", "");
    const [runtimeAction, setRuntimeAction] = ctx.useState("runtimeAction", "");
    const [installedVersion, setInstalledVersion] = ctx.useState("installedVersion", "");
    const [latestVersion, setLatestVersion] = ctx.useState("latestVersion", "");
    const [reloadToken, setReloadToken] = ctx.useState("reloadToken", "0");
    const [pageLoading, setPageLoading] = ctx.useState("pageLoading", false);
    async function startInstalledRuntime(forceRestart) {
        setLoading(true);
        setRuntimeAction("");
        setServerUrl("");
        setPageLoading(false);
        setErrorText("");
        setStatusText("正在启动 DeepSeek Harness Web");
        setProgress(40);
        try {
            const result = await (0, deepseek_harness_web_runtime_js_1.startDeepSeekHarnessWebServer)({
                forceRestart,
                onProgress: (event) => {
                    setStatusText(event.message);
                    setProgress(clampProgress(event.progress));
                },
            });
            if (!result.success) {
                setErrorText(formatStartupFailure(result));
                setStatusText(result.message);
                return;
            }
            setServerUrl(result.url);
            setPageLoading(true);
            setReloadToken(`${Date.now()}`);
            setProgress(90);
            setStatusText("正在加载 DeepSeek Harness");
        }
        catch (error) {
            console.error("DeepSeek Harness startup failed", error);
            setErrorText("无法从 Linux 运行时启动 DeepSeek Harness。");
            setStatusText("DeepSeek Harness 启动失败");
        }
        finally {
            setLoading(false);
        }
    }
    async function inspectAndRoute() {
        setLoading(true);
        setRuntimeAction("");
        setServerUrl("");
        setPageLoading(false);
        setErrorText("");
        setOutputText("");
        setInstalledVersion("");
        setLatestVersion("");
        setStatusText("正在检查 DeepSeek Harness");
        setProgress(5);
        try {
            const inspection = await (0, deepseek_harness_web_runtime_js_1.inspectDeepSeekHarnessRuntime)({
                onProgress: (event) => {
                    setStatusText(event.message);
                    setProgress(clampProgress(event.progress));
                },
            });
            if (inspection.installedVersion !== undefined) {
                setInstalledVersion(inspection.installedVersion);
            }
            if (inspection.latestVersion !== undefined) {
                setLatestVersion(inspection.latestVersion);
            }
            if (inspection.status === "ready") {
                await startInstalledRuntime(false);
                return;
            }
            if (inspection.status === "uninitialized") {
                setRuntimeAction("initialize");
                setStatusText(inspection.message);
                setProgress(0);
                return;
            }
            if (inspection.status === "update_available") {
                setRuntimeAction("update");
                setStatusText(inspection.message);
                setProgress(0);
                return;
            }
            if (inspection.diagnostic !== undefined && inspection.diagnostic.trim()) {
                setErrorText(`${inspection.message}\n\n${inspection.diagnostic.trim()}`);
            }
            else {
                setErrorText(inspection.message);
            }
            setStatusText("DeepSeek Harness 检查失败");
        }
        catch (error) {
            console.error("DeepSeek Harness inspection failed", error);
            setErrorText("无法检查 DeepSeek Harness 运行时。");
            setStatusText("DeepSeek Harness 检查失败");
        }
        finally {
            setLoading(false);
        }
    }
    async function installAndStart() {
        let installationOutput = "";
        setLoading(true);
        setRuntimeAction("");
        setServerUrl("");
        setPageLoading(false);
        setErrorText("");
        setOutputText("");
        setStatusText("正在准备 DeepSeek Harness 安装");
        setProgress(12);
        try {
            const result = await (0, deepseek_harness_web_runtime_js_1.installDeepSeekHarnessRuntime)({
                onProgress: (event) => {
                    setStatusText(event.message);
                    setProgress(clampProgress(event.progress));
                    if (event.output !== undefined && event.output) {
                        installationOutput = appendInstallationOutput(installationOutput, event.output);
                        setOutputText(installationOutput);
                    }
                },
            });
            if (!result.success) {
                const executionDetails = formatInstallExecution(result);
                if (executionDetails) {
                    setOutputText(executionDetails);
                }
                setErrorText(formatInstallFailure(result));
                setStatusText(result.message);
                return;
            }
            await startInstalledRuntime(false);
        }
        catch (error) {
            console.error("DeepSeek Harness installation failed", error);
            setErrorText("DeepSeek Harness 安装未能完成。");
            setStatusText("DeepSeek Harness 安装失败");
        }
        finally {
            setLoading(false);
        }
    }
    const actionButtons = [];
    if (!loading && !errorText && runtimeAction === "initialize") {
        actionButtons.push(UI.Button({
            fillMaxWidth: true,
            height: 48,
            shape: { cornerRadius: 8 },
            contentPadding: { horizontal: 16, vertical: 0 },
            onClick: installAndStart,
        }, UI.Row({
            fillMaxWidth: true,
            horizontalArrangement: "center",
            verticalAlignment: "center",
        }, [
            UI.Icon({ name: "terminal", size: 18, tint: colors.onPrimary }),
            UI.Spacer({ width: 8 }),
            UI.Text({
                text: "初始化 DeepSeek Harness",
                style: "labelLarge",
                color: colors.onPrimary,
            }),
        ])));
    }
    if (!loading && !errorText && runtimeAction === "update") {
        actionButtons.push(UI.Button({
            fillMaxWidth: true,
            height: 48,
            shape: { cornerRadius: 8 },
            contentPadding: { horizontal: 16, vertical: 0 },
            onClick: installAndStart,
        }, UI.Row({
            fillMaxWidth: true,
            horizontalArrangement: "center",
            verticalAlignment: "center",
        }, [
            UI.Icon({ name: "bolt", size: 18, tint: colors.onPrimary }),
            UI.Spacer({ width: 8 }),
            UI.Text({
                text: "安装更新",
                style: "labelLarge",
                color: colors.onPrimary,
            }),
        ])), UI.OutlinedButton({
            fillMaxWidth: true,
            height: 48,
            shape: { cornerRadius: 8 },
            contentPadding: { horizontal: 16, vertical: 0 },
            onClick: () => startInstalledRuntime(false),
        }, UI.Row({
            fillMaxWidth: true,
            horizontalArrangement: "center",
            verticalAlignment: "center",
        }, [
            UI.Icon({ name: "Code", size: 18, tint: colors.primary }),
            UI.Spacer({ width: 8 }),
            UI.Text({
                text: "继续使用当前版本",
                style: "labelLarge",
                color: colors.primary,
            }),
        ])));
    }
    if (!loading && errorText) {
        actionButtons.push(UI.Button({
            fillMaxWidth: true,
            height: 48,
            shape: { cornerRadius: 8 },
            contentPadding: { horizontal: 16, vertical: 0 },
            onClick: inspectAndRoute,
        }, UI.Row({
            fillMaxWidth: true,
            horizontalArrangement: "center",
            verticalAlignment: "center",
        }, [
            UI.Icon({ name: "refresh", size: 18, tint: colors.onPrimary }),
            UI.Spacer({ width: 8 }),
            UI.Text({
                text: "重新检查",
                style: "labelLarge",
                color: colors.onPrimary,
            }),
        ])));
    }
    const busy = loading || pageLoading;
    const showProgress = busy;
    let stateLabel = "准备中";
    let stateIcon = "Code";
    let stateContainerColor = colors.surfaceVariant;
    let stateContentColor = colors.onSurfaceVariant;
    if (errorText) {
        stateLabel = "需要处理";
        stateIcon = "error";
        stateContainerColor = colors.errorContainer;
        stateContentColor = colors.onErrorContainer;
    }
    else if (busy) {
        stateLabel = "进行中";
        stateIcon = "sync";
        stateContainerColor = colors.secondaryContainer;
        stateContentColor = colors.onSecondaryContainer;
    }
    else if (runtimeAction === "initialize") {
        stateLabel = "首次使用";
        stateIcon = "terminal";
        stateContainerColor = colors.tertiaryContainer;
        stateContentColor = colors.onTertiaryContainer;
    }
    else if (runtimeAction === "update") {
        stateLabel = "发现更新";
        stateIcon = "bolt";
        stateContainerColor = colors.tertiaryContainer;
        stateContentColor = colors.onTertiaryContainer;
    }
    const versionSummary = [];
    if (installedVersion || latestVersion) {
        versionSummary.push(UI.Column({
            fillMaxWidth: true,
            spacing: 12,
        }, [
            UI.HorizontalDivider({
                color: stateContentColor.copy({ alpha: 0.18 }),
                thickness: 1,
            }),
            UI.Row({
                fillMaxWidth: true,
                horizontalArrangement: "spaceBetween",
                verticalAlignment: "center",
            }, [
                UI.Column({ weight: 1, spacing: 2 }, [
                    UI.Text({
                        text: "当前版本",
                        style: "labelSmall",
                        color: stateContentColor.copy({ alpha: 0.72 }),
                    }),
                    UI.Text({
                        text: installedVersion || "未安装",
                        style: "bodyMedium",
                        fontWeight: "semiBold",
                        color: stateContentColor,
                        maxLines: 1,
                        overflow: "ellipsis",
                    }),
                ]),
                UI.Column({ weight: 1, spacing: 2, horizontalAlignment: "end" }, [
                    UI.Text({
                        text: "最新版本",
                        style: "labelSmall",
                        color: stateContentColor.copy({ alpha: 0.72 }),
                    }),
                    UI.Text({
                        text: latestVersion || "检查中",
                        style: "bodyMedium",
                        fontWeight: "semiBold",
                        color: stateContentColor,
                        maxLines: 1,
                        overflow: "ellipsis",
                    }),
                ]),
            ]),
        ]));
    }
    const progressSummary = [];
    if (showProgress) {
        progressSummary.push(UI.Column({
            fillMaxWidth: true,
            spacing: 8,
        }, [
            UI.HorizontalDivider({
                color: stateContentColor.copy({ alpha: 0.18 }),
                thickness: 1,
            }),
            UI.Row({
                fillMaxWidth: true,
                horizontalArrangement: "spaceBetween",
                verticalAlignment: "center",
            }, [
                UI.Text({
                    text: "当前进度",
                    style: "labelSmall",
                    color: stateContentColor.copy({ alpha: 0.72 }),
                }),
                UI.Text({
                    text: `${clampProgress(progress)}%`,
                    style: "labelMedium",
                    fontWeight: "semiBold",
                    color: stateContentColor,
                }),
            ]),
            UI.LinearProgressIndicator({
                fillMaxWidth: true,
                progress: clampProgress(progress) / 100,
                color: stateContentColor,
            }),
        ]));
    }
    const showOverlay = busy || !serverUrl || Boolean(errorText) || runtimeAction !== "";
    const overlay = UI.LazyColumn({
        fillMaxSize: true,
        padding: { horizontal: 20, vertical: 24 },
        spacing: 18,
        background: colors.surface,
    }, [
        UI.Row({
            fillMaxWidth: true,
            verticalAlignment: "center",
        }, [
            UI.Surface({
                width: 42,
                height: 42,
                shape: { cornerRadius: 8 },
                containerColor: colors.primaryContainer,
                contentColor: colors.onPrimaryContainer,
            }, UI.Box({
                fillMaxSize: true,
                contentAlignment: "center",
            }, UI.Icon({
                name: "Code",
                size: 22,
                tint: colors.onPrimaryContainer,
            }))),
            UI.Spacer({ width: 12 }),
            UI.Column({ weight: 1, spacing: 2 }, [
                UI.Text({
                    text: "DeepSeek Harness",
                    style: "titleMedium",
                    fontWeight: "bold",
                    color: colors.onSurface,
                    maxLines: 1,
                    overflow: "ellipsis",
                }),
                UI.Text({
                    text: "DSH 运行时",
                    style: "labelMedium",
                    color: colors.onSurfaceVariant,
                }),
            ]),
            UI.Surface({
                shape: { cornerRadius: 6 },
                containerColor: stateContainerColor,
                contentColor: stateContentColor,
            }, UI.Text({
                text: stateLabel,
                padding: { horizontal: 10, vertical: 6 },
                style: "labelSmall",
                fontWeight: "semiBold",
                color: stateContentColor,
                maxLines: 1,
            })),
        ]),
        UI.Surface({
            fillMaxWidth: true,
            shape: { cornerRadius: 8 },
            containerColor: stateContainerColor,
            contentColor: stateContentColor,
        }, UI.Column({
            fillMaxWidth: true,
            padding: 16,
            spacing: 12,
        }, [
            UI.Row({
                fillMaxWidth: true,
                verticalAlignment: "center",
            }, [
                UI.Icon({
                    name: stateIcon,
                    size: 22,
                    tint: stateContentColor,
                    spin: busy,
                    spinDurationMs: 850,
                }),
                UI.Spacer({ width: 10 }),
                UI.Column({ weight: 1, spacing: 3 }, [
                    UI.Text({
                        text: "当前状态",
                        style: "labelSmall",
                        color: stateContentColor.copy({ alpha: 0.72 }),
                    }),
                    UI.Text({
                        text: statusText,
                        style: "titleMedium",
                        fontWeight: "semiBold",
                        color: stateContentColor,
                        maxLines: 3,
                    }),
                ]),
            ]),
            ...(errorText
                ? [UI.Text({
                        text: errorText,
                        style: "bodySmall",
                        color: stateContentColor,
                        maxLines: 10,
                        overflow: "ellipsis",
                    })]
                : []),
            ...versionSummary,
            ...progressSummary,
        ])),
        ...(outputText
            ? [UI.Surface({
                    fillMaxWidth: true,
                    shape: { cornerRadius: 8 },
                    containerColor: colors.surfaceVariant,
                    contentColor: colors.onSurfaceVariant,
                }, UI.Column({
                    fillMaxWidth: true,
                    padding: 14,
                    spacing: 10,
                }, [
                    UI.Row({ verticalAlignment: "center" }, [
                        UI.Icon({
                            name: "terminal",
                            size: 18,
                            tint: colors.onSurfaceVariant,
                        }),
                        UI.Spacer({ width: 8 }),
                        UI.Text({
                            text: "安装输出",
                            style: "labelMedium",
                            fontWeight: "semiBold",
                            color: colors.onSurfaceVariant,
                        }),
                    ]),
                    UI.HorizontalDivider({
                        color: colors.outlineVariant.copy({ alpha: 0.55 }),
                        thickness: 1,
                    }),
                    UI.SelectionContainer({}, UI.Text({
                        text: formatVisibleInstallationOutput(outputText),
                        style: "bodySmall",
                        fontFamily: "monospace",
                        fontSize: 11,
                        color: colors.onSurfaceVariant,
                        maxLines: 16,
                        overflow: "ellipsis",
                    })),
                ]))]
            : []),
        ...(actionButtons.length > 0
            ? [UI.Column({
                    fillMaxWidth: true,
                    spacing: 10,
                }, actionButtons)]
            : []),
    ]);
    const webContent = serverUrl
        ? UI.Box({ fillMaxSize: true }, [
            UI.WebView({
                key: `deepseek_harness_webview_${reloadToken}`,
                fillMaxSize: true,
                url: serverUrl,
                javaScriptEnabled: true,
                domStorageEnabled: true,
                allowFileAccess: false,
                allowContentAccess: false,
                supportZoom: false,
                useWideViewPort: true,
                loadWithOverviewMode: true,
                safeBrowsingEnabled: true,
                onPageStarted: () => {
                    setPageLoading(true);
                    setProgress(92);
                    setStatusText("正在加载 DeepSeek Harness Web 资源");
                },
                onProgressChanged: (event) => {
                    setProgress(Math.max(92, clampProgress(event.progress)));
                },
                onPageFinished: () => {
                    setProgress(100);
                    setStatusText("DeepSeek Harness 已就绪");
                    setPageLoading(false);
                },
                onReceivedError: async () => {
                    setPageLoading(false);
                    setServerUrl("");
                    setErrorText(await (0, deepseek_harness_web_runtime_js_1.readDeepSeekHarnessWebFailure)());
                },
            }),
            showOverlay ? overlay : UI.Spacer({ height: 0 }),
        ])
        : overlay;
    return UI.Box({
        fillMaxSize: true,
        onLoad: async () => {
            if (!initialized) {
                setInitialized(true);
                await inspectAndRoute();
            }
        },
    }, webContent);
}
