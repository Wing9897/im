import { Globe, Mail, Newspaper, Rss } from "lucide-react";
import { DiscordLogo, GitHubLogo, MqttLogo, TelegramLogo } from "../../assets/icons/PlatformLogos";

const TELEGRAM_BRAND_CLASS = "text-[var(--platform-telegram)]";
const DISCORD_BRAND_CLASS = "text-[var(--platform-discord)]";

interface PlatformIconProps {
  platform: string | null | undefined;
  /** Icon size in pixels. Defaults to 12. */
  size?: number;
  className?: string;
}

/**
 * Renders a platform-specific icon for intelligence cards, source lists, etc.
 * Falls back to Globe for unknown platforms.
 */
export function PlatformIcon({ platform, size = 12, className }: PlatformIconProps) {
  if (!platform) return null;

  switch (platform.toLowerCase()) {
    case "telegram":
      // Brand blue so the mark reads as Telegram, not a generic paper-plane glyph.
      return (
        <TelegramLogo
          size={size}
          className={[TELEGRAM_BRAND_CLASS, className].filter(Boolean).join(" ")}
        />
      );
    case "discord":
      return (
        <DiscordLogo
          size={size}
          className={[DISCORD_BRAND_CLASS, className].filter(Boolean).join(" ")}
        />
      );
    case "rss":
      return <Rss size={size} strokeWidth={2.25} aria-hidden="true" className={className} />;
    case "http":
      return <Globe size={size} strokeWidth={2.25} aria-hidden="true" className={className} />;
    case "github":
      return <GitHubLogo size={size} className={className} />;
    case "hackernews":
      return <Newspaper size={size} strokeWidth={2.25} aria-hidden="true" className={className} />;
    case "linuxdo":
      return <Rss size={size} strokeWidth={2.25} aria-hidden="true" className={className} />;
    case "v2ex":
      return <Newspaper size={size} strokeWidth={2.25} aria-hidden="true" className={className} />;
    case "mqtt":
      return <MqttLogo size={size} className={className} />;
    case "email":
      return <Mail size={size} strokeWidth={2.25} aria-hidden="true" className={className} />;
    case "api":
      return <Globe size={size} strokeWidth={2.25} aria-hidden="true" className={className} />;
    default:
      return <Globe size={size} strokeWidth={2.25} aria-hidden="true" className={className} />;
  }
}
