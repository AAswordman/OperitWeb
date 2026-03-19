import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal, Progress } from 'antd';
import type { ButtonProps } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import SupportDevelopmentButton from './SupportDevelopmentButton';

interface DownloadLatestButtonProps {
  downloadText: string;
  language: 'zh' | 'en';
  block?: boolean;
  buttonSize?: ButtonProps['size'];
  buttonType?: ButtonProps['type'];
  className?: string;
  onOpen?: () => void;
  style?: React.CSSProperties;
  withMotion?: boolean;
}

interface GitHubMirror {
  name: string;
  url: string;
}

interface MirrorProbeResult extends GitHubMirror {
  averageSpeedMBps: number | null;
  error: string | null;
  speedSamplesMBps: number[];
  state: 'pending' | 'testing' | 'success' | 'failed';
}

type DownloadStage = 'idle' | 'choice' | 'manual' | 'availability' | 'speed';

const GITHUB_MIRRORS: GitHubMirror[] = [
  { name: 'Ghfast', url: 'https://ghfast.top/' },
  { name: 'GhProxy', url: 'https://ghproxy.com/' },
  { name: 'GhProxyNet', url: 'https://ghproxy.net/' },
  { name: 'GhProxyMirror', url: 'https://mirror.ghproxy.com/' },
  { name: 'Flash', url: 'https://flash.aaswordsman.org/' },
  { name: 'Gh-Proxy', url: 'https://gh-proxy.com/' },
  { name: 'GitMirror', url: 'https://hub.gitmirror.com/' },
  { name: 'Moeyy', url: 'https://github.moeyy.xyz/' },
  { name: 'Workers', url: 'https://github.abskoop.workers.dev/' },
  { name: 'H233', url: 'https://gh.h233.eu.org/' },
  { name: 'Gh1888866', url: 'https://ghproxy.1888866.xyz/' },
  { name: 'GhProxyCfd', url: 'https://ghproxy.cfd/' },
  { name: 'BokiMoe', url: 'https://github.boki.moe/' },
  { name: 'GhProxyNetHyphen', url: 'https://gh-proxy.net/' },
  { name: 'JasonZeng', url: 'https://gh.jasonzeng.dev/' },
  { name: 'Monlor', url: 'https://gh.monlor.com/' },
  { name: 'FastGitCc', url: 'https://fastgit.cc/' },
  { name: 'Tbedu', url: 'https://github.tbedu.top/' },
  { name: 'FirewallLxstd', url: 'https://firewall.lxstd.org/' },
  { name: 'Ednovas', url: 'https://github.ednovas.xyz/' },
  { name: 'GeekerTao', url: 'https://ghfile.geekertao.top/' },
  { name: 'Chjina', url: 'https://gh.chjina.com/' },
  { name: 'Hwinzniej', url: 'https://ghpxy.hwinzniej.top/' },
  { name: 'CrashMc', url: 'https://cdn.crashmc.com/' },
  { name: 'Yylx', url: 'https://git.yylx.win/' },
  { name: 'Mrhjx', url: 'https://gitproxy.mrhjx.cn/' },
  { name: 'Cxkpro', url: 'https://ghproxy.cxkpro.top/' },
  { name: 'Xxooo', url: 'https://gh.xxooo.cf/' },
  { name: 'Limoruirui', url: 'https://github.limoruirui.com/' },
  { name: 'Llkk', url: 'https://gh.llkk.cc/' },
  { name: 'Npee', url: 'https://down.npee.cn/?' },
  { name: 'Nxnow', url: 'https://gh.nxnow.top/' },
  { name: 'Zwy', url: 'https://gh.zwy.one/' },
  { name: 'Monkeyray', url: 'https://ghproxy.monkeyray.net/' },
  { name: 'Xx9527', url: 'https://gh.xx9527.cn/' }
];

const SPEED_TEST_PROBES_PER_CANDIDATE = 2;
const PROBE_TIMEOUT_MS = 4500;
const AVAILABILITY_PROGRESS_END = 60;
const SPEED_TEST_PROGRESS_END = 92;
const SPEED_TEST_SAMPLE_URL =
  'https://github.com/AAswordman/OperitWeb/raw/main/public/manuals/assets/workflow/01.png';
const SPEED_TEST_SAMPLE_BYTES = 1363888;

const createInitialProbeResults = (): MirrorProbeResult[] =>
  GITHUB_MIRRORS.map((mirror) => ({
    ...mirror,
    averageSpeedMBps: null,
    error: null,
    speedSamplesMBps: [],
    state: 'pending'
  }));

const getAverageValue = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const formatSpeedMBps = (value: number | null): string => {
  if (value === null) {
    return '--';
  }

  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} MB/s`;
};

const createMirrorDownloadUrl = (mirrorUrl: string, targetUrl: string): string => `${mirrorUrl}${targetUrl}`;

const createCacheBustedUrl = (url: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}operit_probe=${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const probeMirrorAvailability = async (targetUrl: string, signal: AbortSignal): Promise<void> => {
  const requestController = new AbortController();
  const cancelRequest = () => requestController.abort();

  if (signal.aborted) {
    requestController.abort();
  } else {
    signal.addEventListener('abort', cancelRequest, { once: true });
  }

  const timeoutId = window.setTimeout(() => requestController.abort(), PROBE_TIMEOUT_MS);

  try {
    await fetch(targetUrl, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      redirect: 'follow',
      signal: requestController.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
    signal.removeEventListener('abort', cancelRequest);
  }
};

const measureMirrorDownloadSpeed = async (targetUrl: string, signal: AbortSignal): Promise<number> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const startedAt = performance.now();
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      finalize(new Error('测速超时'));
    }, PROBE_TIMEOUT_MS);

    const abortHandler = () => {
      finalize(new DOMException('Aborted', 'AbortError'));
    };

    const finalize = (error?: Error | DOMException) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', abortHandler);
      image.onload = null;
      image.onerror = null;
      image.src = '';

      if (error) {
        reject(error);
        return;
      }

      const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
      const speedMBps = SPEED_TEST_SAMPLE_BYTES / 1024 / 1024 / elapsedSeconds;
      resolve(speedMBps);
    };

    if (signal.aborted) {
      finalize(new DOMException('Aborted', 'AbortError'));
      return;
    }

    signal.addEventListener('abort', abortHandler, { once: true });

    image.decoding = 'async';
    image.loading = 'eager';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => finalize();
    image.onerror = () => finalize(new Error('测速样本加载失败'));
    image.src = createCacheBustedUrl(targetUrl);
  });

const DownloadLatestButton: React.FC<DownloadLatestButtonProps> = ({
  downloadText,
  language,
  block = false,
  buttonSize = 'large',
  buttonType = 'primary',
  className,
  onOpen,
  style,
  withMotion = true
}) => {
  const [downloadUrl, setDownloadUrl] = useState<string>('https://github.com/AAswordman/Operit/releases');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isTestingMirrors, setIsTestingMirrors] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('准备开始检测下载线路...');
  const [currentStage, setCurrentStage] = useState<DownloadStage>('idle');
  const [probeResults, setProbeResults] = useState<MirrorProbeResult[]>(() => createInitialProbeResults());
  const [isThanksModalVisible, setIsThanksModalVisible] = useState<boolean>(false);
  const [downloadedSourceName, setDownloadedSourceName] = useState<string | null>(null);
  const [downloadedTargetUrl, setDownloadedTargetUrl] = useState<string | null>(null);
  const [hasOpenedDownloadLink, setHasOpenedDownloadLink] = useState<boolean>(false);

  const probeAbortControllerRef = useRef<AbortController | null>(null);

  const resetDownloadState = () => {
    setProbeResults(createInitialProbeResults());
    setProgressPercent(0);
    setStatusText('准备开始检测下载线路...');
  };

  useEffect(() => {
    const fetchLatestRelease = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('https://api.github.com/repos/AAswordman/Operit/releases/latest');
        if (!response.ok) {
          throw new Error(`GitHub API request failed with status ${response.status}`);
        }

        const data = (await response.json()) as {
          assets?: Array<{ name: string; browser_download_url: string }>;
        };
        const apkAsset = data.assets?.find((asset) => asset.name.endsWith('.apk'));
        if (apkAsset) {
          setDownloadUrl(apkAsset.browser_download_url);
        }
      } catch (error) {
        console.error('Error fetching GitHub release:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestRelease();

    return () => {
      probeAbortControllerRef.current?.abort();
    };
  }, []);

  const handleCancel = () => {
    probeAbortControllerRef.current?.abort();
    probeAbortControllerRef.current = null;
    setIsTestingMirrors(false);
    resetDownloadState();
    setCurrentStage('idle');
    setIsModalVisible(false);
  };

  const handleThanksClose = () => {
    setIsThanksModalVisible(false);
  };

  const showDownloadOptions = () => {
    if (isLoading || isTestingMirrors) {
      return;
    }

    onOpen?.();
    resetDownloadState();
    setDownloadedSourceName(null);
    setDownloadedTargetUrl(null);
    setHasOpenedDownloadLink(false);
    setIsThanksModalVisible(false);
    setCurrentStage('choice');
    setIsModalVisible(true);
  };

  const openManualDownloadList = () => {
    resetDownloadState();
    setCurrentStage('manual');
    setIsModalVisible(true);
  };

  const prepareDownload = (sourceName: string, targetUrl: string, hasOpenedLink = false) => {
    setDownloadedSourceName(sourceName);
    setDownloadedTargetUrl(targetUrl);
    setHasOpenedDownloadLink(hasOpenedLink);
    setIsModalVisible(false);
    setCurrentStage('idle');
    setIsThanksModalVisible(true);
  };

  const startSmartDownload = async () => {
    if (isLoading || isTestingMirrors) {
      return;
    }

    const abortController = new AbortController();
    probeAbortControllerRef.current = abortController;

    const workingResults = createInitialProbeResults();
    const publishResults = () => {
      if (abortController.signal.aborted) {
        return;
      }

      setProbeResults(
        workingResults.map((result) => ({
          ...result,
          speedSamplesMBps: [...result.speedSamplesMBps]
        }))
      );
    };

    const updateMirrorResult = (
      mirrorName: string,
      updater: (current: MirrorProbeResult) => MirrorProbeResult
    ) => {
      const mirrorIndex = workingResults.findIndex((mirror) => mirror.name === mirrorName);
      if (mirrorIndex === -1) {
        return;
      }

      workingResults[mirrorIndex] = updater(workingResults[mirrorIndex]);
      publishResults();
    };

    setProbeResults(workingResults);
    setProgressPercent(3);
    setStatusText('正在初始化测速任务...');
    setCurrentStage('availability');
    setIsModalVisible(true);
    setIsTestingMirrors(true);

    try {
      setStatusText(`正在检测 ${GITHUB_MIRRORS.length} 个镜像的可用性...`);
      let availabilityCompleted = 0;

      const availabilityChecks = await Promise.all(
        GITHUB_MIRRORS.map(async (mirror) => {
          updateMirrorResult(mirror.name, (current) => ({
            ...current,
            error: null,
            state: 'testing'
          }));

          try {
            await probeMirrorAvailability(
              createMirrorDownloadUrl(mirror.url, downloadUrl),
              abortController.signal
            );

            updateMirrorResult(mirror.name, (current) => ({
              ...current,
              error: null,
              state: 'success'
            }));

            return mirror;
          } catch (error) {
            if (abortController.signal.aborted) {
              throw error;
            }

            updateMirrorResult(mirror.name, (current) => ({
              ...current,
              averageSpeedMBps: null,
              error: '首轮探测失败',
              speedSamplesMBps: [],
              state: 'failed'
            }));

            return null;
          } finally {
            availabilityCompleted += 1;
            setProgressPercent(
              Math.round((availabilityCompleted / GITHUB_MIRRORS.length) * AVAILABILITY_PROGRESS_END)
            );
          }
        })
      );

      if (abortController.signal.aborted) {
        return;
      }

      const availableMirrors = availabilityChecks.filter((mirror): mirror is GitHubMirror => mirror !== null);

      if (availableMirrors.length === 0) {
        setProgressPercent(100);
        setStatusText('全部镜像探测失败，已自动回退到 GitHub 原链，请点击下载链接继续。');
        prepareDownload('GitHub', downloadUrl);
        return;
      }

      setStatusText(`已筛出 ${availableMirrors.length} 个可用镜像，正在下载测速样本并计算速度...`);
      setCurrentStage('speed');

      const totalSpeedProbes = availableMirrors.length * SPEED_TEST_PROBES_PER_CANDIDATE;
      let completedSpeedProbes = 0;

      for (let probeRound = 0; probeRound < SPEED_TEST_PROBES_PER_CANDIDATE; probeRound += 1) {
        await Promise.all(
          availableMirrors.map(async (mirror) => {
            updateMirrorResult(mirror.name, (current) => ({
              ...current,
              state: 'testing'
            }));

            try {
              const speedMBps = await measureMirrorDownloadSpeed(
                createMirrorDownloadUrl(mirror.url, SPEED_TEST_SAMPLE_URL),
                abortController.signal
              );

              updateMirrorResult(mirror.name, (current) => {
                const speedSamplesMBps = [...current.speedSamplesMBps, speedMBps];
                return {
                  ...current,
                  averageSpeedMBps: getAverageValue(speedSamplesMBps),
                  error: null,
                  speedSamplesMBps,
                  state: 'success'
                };
              });
            } catch (error) {
              if (abortController.signal.aborted) {
                throw error;
              }

              updateMirrorResult(mirror.name, (current) => ({
                ...current,
                error: current.speedSamplesMBps.length > 0 ? '部分测速失败' : '测速失败',
                state: current.speedSamplesMBps.length > 0 ? 'success' : 'failed'
              }));
            } finally {
              completedSpeedProbes += 1;
              setProgressPercent(
                Math.round(
                  AVAILABILITY_PROGRESS_END +
                    (completedSpeedProbes / totalSpeedProbes) *
                      (SPEED_TEST_PROGRESS_END - AVAILABILITY_PROGRESS_END)
                )
              );
            }
          })
        );

        if (abortController.signal.aborted) {
          return;
        }
      }

      const availableMirrorNames = new Set(availableMirrors.map((mirror) => mirror.name));
      const bestMirror = workingResults
        .filter((mirror) => availableMirrorNames.has(mirror.name) && mirror.averageSpeedMBps !== null)
        .sort(
          (left, right) =>
            (right.averageSpeedMBps ?? Number.NEGATIVE_INFINITY) -
            (left.averageSpeedMBps ?? Number.NEGATIVE_INFINITY)
        )[0];

      if (!bestMirror) {
        setProgressPercent(100);
        setStatusText('测速结果不可用，已自动回退到 GitHub 原链，请点击下载链接继续。');
        prepareDownload('GitHub', downloadUrl);
        return;
      }

      const bestMirrorUrl = createMirrorDownloadUrl(bestMirror.url, downloadUrl);

      setProgressPercent(100);
      setStatusText(`已选择最快镜像 ${bestMirror.name}，请点击下载链接开始下载。`);
      prepareDownload(bestMirror.name, bestMirrorUrl);
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Error testing download mirrors:', error);
        setProgressPercent(100);
        setStatusText('测速过程中发生异常，已自动回退到 GitHub 原链，请点击下载链接继续。');
        prepareDownload('GitHub', downloadUrl);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setIsTestingMirrors(false);
      }
      probeAbortControllerRef.current = null;
    }
  };

  const speedRankedResults = [...probeResults]
    .filter((mirror) => mirror.speedSamplesMBps.length > 0 && mirror.averageSpeedMBps !== null)
    .sort(
      (left, right) =>
        (right.averageSpeedMBps ?? Number.NEGATIVE_INFINITY) -
        (left.averageSpeedMBps ?? Number.NEGATIVE_INFINITY)
    )
    .slice(0, 6);

  const manualDownloadSources = [
    { name: 'GitHub 原版', url: downloadUrl },
    ...GITHUB_MIRRORS.map((mirror) => ({
      name: mirror.name,
      url: createMirrorDownloadUrl(mirror.url, downloadUrl)
    }))
  ];

  const guideUrl =
    typeof window === 'undefined' ? '#/guide' : `${window.location.origin}${window.location.pathname}#/guide`;
  const quickStartUrl =
    typeof window === 'undefined'
      ? '#/guide/quick-start'
      : `${window.location.origin}${window.location.pathname}#/guide/quick-start`;

  const modalTitle = (() => {
    switch (currentStage) {
      case 'choice':
        return '选择下载方式';
      case 'manual':
        return '手动选择下载源';
      default:
        return '智能选择下载线路';
    }
  })();

  const defaultButtonStyle: React.CSSProperties =
    buttonSize === 'large'
      ? {
          height: 52,
          fontSize: 18,
          paddingLeft: 36,
          paddingRight: 36,
          borderRadius: '8px',
          boxShadow: '0 4px 15px rgba(24, 144, 255, 0.2)'
        }
      : {
          borderRadius: '8px'
        };

  const triggerButton = (
    <Button
      block={block}
      className={className}
      type={buttonType}
      size={buttonSize}
      icon={<DownloadOutlined />}
      style={{ ...defaultButtonStyle, ...style }}
      onClick={showDownloadOptions}
      loading={isLoading || isTestingMirrors}
    >
      {downloadText}
    </Button>
  );

  return (
    <>
      {withMotion ? (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          {triggerButton}
        </motion.div>
      ) : (
        triggerButton
      )}

      <Modal title={modalTitle} open={isModalVisible} onCancel={handleCancel} footer={null} centered>
        {currentStage === 'choice' && (
          <div style={{ color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 12 }}>
            <div style={{ color: 'var(--text-color)', fontSize: 14, lineHeight: 1.7 }}>
              你可以让系统自动测速并选择最快下载源，也可以手动从完整下载源列表中自行选择。
            </div>
            <Button type="primary" size="large" onClick={startSmartDownload}>
              自动选择最快源
            </Button>
            <Button size="large" onClick={openManualDownloadList}>
              手动选择下载源
            </Button>
          </div>
        )}

        {currentStage === 'manual' && (
          <div style={{ color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 12 }}>
            <div style={{ color: 'var(--text-color-secondary)', fontSize: 13, lineHeight: 1.6 }}>
              下面列出 GitHub 原版和全部镜像源。点击后会在新标签页中打开对应下载链接。
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button type="primary" onClick={() => setCurrentStage('choice')}>
                返回
              </Button>
              <Button onClick={handleCancel}>
                关闭
              </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
              {manualDownloadSources.map((source, index) => (
                <Button
                  key={source.name}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    prepareDownload(source.name, source.url, true);
                  }}
                  style={{
                    alignItems: 'center',
                    display: 'flex',
                    height: 'auto',
                    justifyContent: 'space-between',
                    minHeight: 54,
                    textAlign: 'left',
                    whiteSpace: 'normal'
                  }}
                >
                  {`${index + 1}. ${source.name}`}
                </Button>
              ))}
            </div>
          </div>
        )}

        {(currentStage === 'availability' || currentStage === 'speed') && (
          <div style={{ color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 12 }}>
            <div>
              <Progress percent={progressPercent} status={isTestingMirrors ? 'active' : 'normal'} />
              <div style={{ color: 'var(--text-color)', fontSize: 14, marginTop: 8 }}>
                {statusText}
              </div>
            </div>

            <div style={{ color: 'var(--text-color-secondary)', fontSize: 13, lineHeight: 1.6 }}>
              浏览器端会先筛掉不可用镜像，再下载一个已知大小的测速样本并按 MB/s 计算速度，最后自动选择最快镜像。
            </div>

            {currentStage === 'speed' && speedRankedResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ color: 'var(--text-color)', fontSize: 15, fontWeight: 700 }}>
                  下载测速结果
                </div>
                {speedRankedResults.map((mirror, index) => (
                  <div
                    key={mirror.name}
                    style={{
                      alignItems: 'center',
                      background: 'var(--background-color-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      boxShadow: '0 6px 18px rgba(0, 0, 0, 0.12)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      minHeight: 58,
                      padding: '12px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ color: 'var(--text-color)', fontSize: 14, fontWeight: 700 }}>
                        {`${index + 1}. ${mirror.name}`}
                      </span>
                      <span style={{ color: 'var(--text-color-secondary)', fontSize: 12, wordBreak: 'break-all' }}>
                        {mirror.url}
                      </span>
                    </div>
                    <span style={{ color: 'var(--primary-color)', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {`${formatSpeedMBps(mirror.averageSpeedMBps)} / ${mirror.speedSamplesMBps.length} 次`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <SupportDevelopmentButton
            language={language}
            buttonSize="middle"
            buttonType="primary"
            style={{
              background: '#f96854',
              borderColor: '#f96854',
            }}
            withMotion={false}
          />
        </div>
      </Modal>

      <Modal
        title="感谢下载使用"
        open={isThanksModalVisible}
        onCancel={handleThanksClose}
        footer={null}
        centered
      >
        <div style={{ color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 12 }}>
          <Alert
            type="success"
            showIcon
            message="Operit AI 下载链接已准备好"
            description={
              downloadedSourceName
                ? hasOpenedDownloadLink
                  ? `下载链接已打开，当前下载源：${downloadedSourceName}`
                  : `已为你准备好下载链接，当前下载源：${downloadedSourceName}`
                : hasOpenedDownloadLink
                  ? '下载链接已打开。'
                  : '已为你准备好下载链接。'
            }
          />

          {downloadedTargetUrl && (
            <Button
              type="primary"
              href={downloadedTargetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setHasOpenedDownloadLink(true)}
            >
              {hasOpenedDownloadLink ? '再次打开下载链接' : '打开下载链接'}
            </Button>
          )}

          <div style={{ color: 'var(--text-color-secondary)', fontSize: 14, lineHeight: 1.7 }}>
            建议你接下来先查看快速开始文档，按步骤完成权限、模型和基础配置。
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <span>快速开始：{quickStartUrl}</span>
            <span>完整文档：{guideUrl}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button href={quickStartUrl} target="_blank">
              打开快速开始
            </Button>
            <Button href={guideUrl} target="_blank">
              打开完整文档
            </Button>
            <SupportDevelopmentButton
              language={language}
              buttonSize="middle"
              buttonType="primary"
              style={{
                background: '#f96854',
                borderColor: '#f96854',
              }}
              withMotion={false}
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DownloadLatestButton;
