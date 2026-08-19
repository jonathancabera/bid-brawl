import { Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import AuctionList from './pages/AuctionList';
import AuctionDetail from './pages/AuctionDetail';
import CreateAuction from './pages/CreateAuction';
import Login from './pages/Login';
import Register from './pages/Register';
import PaymentMethod from './pages/PaymentMethod';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<AuctionList />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auctions/:id" element={<AuctionDetail />} />
        <Route path="/create" element={<CreateAuction />} />
        <Route path="/payment" element={<PaymentMethod />} />
      </Route>
    </Routes>
  );
}

export default App;
