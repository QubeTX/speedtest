import SettingsView from '../views/SettingsView';

export default function SettingsPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <SettingsView />
    </div>
  );
}
