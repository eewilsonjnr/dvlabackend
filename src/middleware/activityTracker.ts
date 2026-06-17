import { Request, Response, NextFunction } from 'express';

let lastActivity = new Date();

export function recordActivity() { lastActivity = new Date(); }
export function getLastActivityTime() { return lastActivity; }

export function activityTracker(req: Request, res: Response, next: NextFunction): void {
  recordActivity();
  next();
}
