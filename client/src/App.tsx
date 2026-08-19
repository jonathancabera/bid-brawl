import { Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import AuctionList from './pages/AuctionList';
import AuctionDetail from './pages/AuctionDetail';
import CreateAuction from './pages/CreateAuction';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import PaymentMethod from './pages/PaymentMethod';
import { getToken } from './api/auth';

function Home() {
  return getToken() !== null ? <AuctionList /> : <Landing />;
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/auctions" element={<AuctionList />} />
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
