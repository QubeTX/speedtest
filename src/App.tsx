import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SpeedTestProvider } from './store/SpeedTestContext';
import PretextProvider from './providers/PretextProvider';
import { TooltipProvider } from './components/ui/Tooltip';
import SpeedTestPage from './pages/SpeedTestPage';
import SettingsPage from './pages/SettingsPage';
import TechnicalReportPage from './pages/TechnicalReportPage';

export default function App() {
  return (
    <SpeedTestProvider>
      <PretextProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<SpeedTestPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/how-it-works" element={<TechnicalReportPage />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PretextProvider>
    </SpeedTestProvider>
  );
}
