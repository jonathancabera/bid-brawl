import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import auctionRoutes from './routes/auctions';
import bidRoutes from './routes/bids';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/auctions/:auctionId/bids', bidRoutes);
app.use('/api/auctions', auctionRoutes);
