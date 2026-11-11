import { t } from "../i18n";
import { useEffect } from "react";
import packageInfo from "../../package.json";
import { desktop } from "../desktop/desktop";
import { errorMessage } from "../desktop/errors";

const repositoryUrl = "https://github.com/lxw112190/lw.MD";
const latestReleaseUrl = `${repositoryUrl}/releases/latest`;
const sponsorImageUrl = new URL(
  "../../../docs/assets/sponsor.jpg",
  import.meta.url,
).href;

interface AboutDialogProps {
  onClose(): void;
  onStatus(message: string): void;
}

export function AboutDialog({ onClose, onStatus }: AboutDialogProps) {
  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  const openWebsite = async (url: string, label: string) => {
    try {
      await desktop.app.openExternal(url);
      onStatus(t("已在浏览器打开{0}", label));
    } catch (error) {
      onStatus(errorMessage(error));
    }
  };

  return (
    <div
      className="about-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <button
          className="about-close"
          aria-label={t("关闭关于窗口")}
          onClick={onClose}
        >
          ×
        </button>
        <img src="/app-icon.png" alt="" className="about-icon" />
        <h2 id="about-title">{t("lw.MD（简墨）")}</h2>
        <p className="about-version">
          {t("版本")}
          {packageInfo.version}
        </p>
        <p className="about-description">
          {t("简洁轻量的 Windows 本地 Markdown 编辑器")}
        </p>
        <div className="about-support">
          <div className="about-contact">
            <h3>{t("联系与支持")}</h3>
            <dl>
              <div>
                <dt>{t("作者")}</dt>
                <dd>{t("天天代码码天天")}</dd>
              </div>
              <div>
                <dt>QQ</dt>
                <dd>819069052</dd>
              </div>
              <div>
                <dt>{t("QQ群")}</dt>
                <dd>
                  {t("C# 人工智能实践")}
                  <small>{t("群号：758616458")}</small>
                </dd>
              </div>
            </dl>
            <p>{t("如果项目对你有帮助，可以扫码支持后续维护。")}</p>
          </div>
          <figure className="about-sponsor">
            <svg
              viewBox="280 350 558 558"
              role="img"
              aria-label={t("微信赞助二维码")}
            >
              <image
                href={sponsorImageUrl}
                x="0"
                y="0"
                width="1118"
                height="1536"
              />
            </svg>
            <figcaption>{t("微信扫码支持维护")}</figcaption>
          </figure>
        </div>
        <div className="about-actions">
          <button
            className="primary"
            onClick={() => void openWebsite(repositoryUrl, " GitHub")}
          >
            {t("GitHub 项目主页")}
          </button>
          <button
            onClick={() =>
              void openWebsite(latestReleaseUrl, t("最新版本页面"))
            }
          >
            {t("查看最新版本")}
          </button>
        </div>
        <p className="about-meta">MIT License · Copyright © 2026</p>
      </section>
    </div>
  );
}
