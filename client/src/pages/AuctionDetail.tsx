import { useParams } from 'react-router-dom';

export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  return <div>AuctionDetail {id}</div>;
}
