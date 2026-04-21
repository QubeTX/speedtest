import { useIsIOS } from '../../hooks/useIsIOS';

const APP_STORE_URL = 'https://apps.apple.com/us/app/speedqx/id6760538784';

export default function AppStoreBadge() {
  const isIOS = useIsIOS();

  if (!isIOS) return null;

  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download SpeedQX on the App Store"
      style={{
        display: 'inline-block',
        transition: 'transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <img
        src="/app-store-badge.svg"
        alt="Download on the App Store"
        style={{ height: '40px', width: 'auto', display: 'block' }}
      />
    </a>
  );
}
