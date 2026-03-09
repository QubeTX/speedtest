import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SpeedTestProvider } from './store/SpeedTestContext';
import SpeedTestPage from './pages/SpeedTestPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <SpeedTestProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SpeedTestPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
    </SpeedTestProvider>
  );
}
