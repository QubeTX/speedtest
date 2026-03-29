import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SpeedTestProvider } from './store/SpeedTestContext';
import PretextProvider from './providers/PretextProvider';
import SpeedTestPage from './pages/SpeedTestPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <SpeedTestProvider>
      <PretextProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<SpeedTestPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </BrowserRouter>
      </PretextProvider>
    </SpeedTestProvider>
  );
}
