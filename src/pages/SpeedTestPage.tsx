import MainTestView from '../views/MainTestView';

export default function SpeedTestPage() {
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
      <MainTestView />
    </div>
  );
}
