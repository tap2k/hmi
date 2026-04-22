import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Debug from './pages/Debug';
import Backhoe from './pages/Backhoe';
import WheelLoader from './pages/WheelLoader';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<WheelLoader />} />
        <Route path="/backhoe" element={<Backhoe />} />
        <Route path="/debug" element={<Debug />} />
      </Routes>
    </BrowserRouter>
  );
}
