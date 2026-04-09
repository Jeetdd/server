import { Request, Response, NextFunction } from 'express';

// Simple shared-secret check for requests proxied through the Next.js app.
// This lets us keep user-specific endpoints private without exposing `?email=` publicly.
export function requireInternalToken(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INTERNAL_API_TOKEN;

  if (!expected) {
    // Avoid breaking local/dev if the env var isn't set.
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ message: 'Server misconfigured: INTERNAL_API_TOKEN is missing' });
    }
    return next();
  }

  const provided = req.header('x-internal-token');
  if (!provided || provided !== expected) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  return next();
}

export function getInternalUserEmail(req: Request) {
  const email = req.header('x-user-email');
  return typeof email === 'string' ? email.trim() : '';
}

