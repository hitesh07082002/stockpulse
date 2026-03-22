import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import StockDetailPage from './pages/StockDetailPage';
import ScreenerPage from './pages/ScreenerPage';
import AboutPage from './pages/AboutPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/stock/:ticker" element={<StockDetailPage />} />
        <Route path="/screener" element={<ScreenerPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
