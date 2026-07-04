import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRoutes from './routes/auth';
import auctionRoutes from './routes/auctions';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
