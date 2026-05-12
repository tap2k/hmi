import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Debug from './pages/Debug';
import Backhoe from './pages/Backhoe';
import Console from './pages/Console';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Console />} />
        <Route path="/backhoe" element={<Backhoe />} />
        <Route path="/debug" element={<Debug />} />
      </Routes>
    </BrowserRouter>
  );
}
