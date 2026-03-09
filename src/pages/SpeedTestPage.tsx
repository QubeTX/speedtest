import MainTestView from '../views/MainTestView';

export default function SpeedTestPage() {
  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflow: 'hidden',
      }}
    >
      <MainTestView />
    </div>
  );
}
