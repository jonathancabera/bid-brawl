import { Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import AuctionList from './pages/AuctionList';
import AuctionDetail from './pages/AuctionDetail';
import CreateAuction from './pages/CreateAuction';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<AuctionList />} />
        <Route path="/auctions/:id" element={<AuctionDetail />} />
        <Route path="/create" element={<CreateAuction />} />
      </Route>
    </Routes>
  );
}

export default App;
