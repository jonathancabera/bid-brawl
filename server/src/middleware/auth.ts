import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest} from '../types/auth';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authorization header missing' });
      return;
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      res.status(401).json({ error: 'token does not exist' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ error: 'server misconfiguration' });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded === 'string' || !('user_id' in decoded)) {
      res.status(401).json({ error: 'invalid token payload' });
      return;
    }

    (req as AuthRequest).user = {user_id: decoded.user_id}

    next();
  } catch (err) {
    res.status(401).json({error: 'invalid or expired token'});
    return;
  }
}
