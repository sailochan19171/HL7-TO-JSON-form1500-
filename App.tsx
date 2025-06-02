import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CMSConverter from './pages/CMSConverter';

function App() {
  return (
    <Router>
      <div>
        <Link to="/converter">CMS 1500 CONVERTER</Link>
        <Routes>
          <Route path="/converter" element={<CMSConverter />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
