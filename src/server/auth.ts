import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { count, eq } from 'drizzle-orm';
import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { auditLogs, users } from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const OWNER_ADMIN_EMAIL = 'muherezadaniel98@gmail.com';

export interface AuthUser {
  id: number;
  uid: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

export interface AuthRequest extends Request {
  authUser?: AuthUser;
}

function sanitizeUser(u: typeof users.$inferSelect): AuthUser {
  return {
    id: u.id,
    uid: u.uid,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
  };
}

function signLocalToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
      iss: 'marketsphere-local',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function resolveAuthUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  // 1. Try local JWT first
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      sub?: string;
      iss?: string;
    };
    if (decoded && decoded.iss === 'marketsphere-local' && decoded.sub) {
      const userId = Number(decoded.sub);
      if (Number.isInteger(userId) && userId > 0) {
        const [found] = await db.select().from(users).where(eq(users.id, userId));
        if (found && found.status === 'active') {
          return sanitizeUser(found);
        }
      }
      return null;
    }
  } catch {
    // Fall through to Firebase ID token verification
  }

  // 2. Verify Firebase ID Token
  try {
    const decodedFirebase = await adminAuth.verifyIdToken(token);
    const email = (decodedFirebase.email || '').toLowerCase().trim();
    if (!email) return null;

    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      const shouldElevateOwner =
        email === OWNER_ADMIN_EMAIL && existing.role !== 'admin';
      if (existing.uid !== decodedFirebase.uid || shouldElevateOwner) {
        const [updated] = await db
          .update(users)
          .set({
            uid: decodedFirebase.uid,
            role: shouldElevateOwner ? 'admin' : existing.role,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.id))
          .returning();
        return updated.status === 'active' ? sanitizeUser(updated) : null;
      }
      return existing.status === 'active' ? sanitizeUser(existing) : null;
    }

    const assignedRole = email === OWNER_ADMIN_EMAIL ? 'admin' : 'customer';
    const [created] = await db
      .insert(users)
      .values({
        uid: decodedFirebase.uid,
        fullName: decodedFirebase.name || email.split('@')[0],
        email,
        phone: decodedFirebase.phone_number || '',
        role: assignedRole,
        status: 'active',
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          uid: decodedFirebase.uid,
          updatedAt: new Date(),
        },
      })
      .returning();

    return sanitizeUser(created);
  } catch {
    return null;
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  req.authUser = (await resolveAuthUser(req)) ?? undefined;
  next();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await resolveAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
  }
  req.authUser = user;
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}

export const authRouter = express.Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email: z.string().trim().email('Valid email is required').max(160),
  phone: z.string().trim().min(7, 'Phone number is required').max(30),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data' });
    }

    const email = parsed.data.email.toLowerCase();
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [created] = await db
      .insert(users)
      .values({
        fullName: parsed.data.fullName,
        email,
        phone: parsed.data.phone,
        passwordHash,
        role: 'customer',
        status: 'active',
      })
      .returning();

    const safeUser = sanitizeUser(created);
    const token = signLocalToken(safeUser);

    await db.insert(auditLogs).values({
      actorUserId: created.id,
      actorEmail: created.email,
      action: 'CUSTOMER_REGISTERED',
      entityType: 'user',
      entityId: String(created.id),
      details: { fullName: created.fullName },
    });

    res.status(201).json({ user: safeUser, token });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials' });
    }

    const email = parsed.data.email.toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'This account has been suspended. Contact store administration.' });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const safeUser = sanitizeUser(user);
    const token = signLocalToken(safeUser);
    res.json({ user: safeUser, token });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/firebase-sync', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.authUser });
});

authRouter.get('/bootstrap-status', async (_req, res, next) => {
  try {
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const [{ total }] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.role, 'admin'));

    // Check if any admin has a claimed local passwordHash
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    const hasPasswordAdmin = admins.some((a) => Boolean(a.passwordHash));

    res.json({
      hasAnyAdmin: total > 0,
      hasPasswordAdmin,
      passcodeConfigured: envPasscode.length > 0,
      needsAdminClaim: envPasscode.length === 0 && !hasPasswordAdmin,
    });
  } catch (err) {
    next(err);
  }
});

const bootstrapSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
});

authRouter.post('/bootstrap-admin', async (req, res, next) => {
  try {
    const parsed = bootstrapSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid admin setup request' });
    }

    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const email = parsed.data.email.toLowerCase();

    if (envPasscode.length > 0) {
      // Passcode override configured in environment secrets
      const matchesEnv =
        parsed.data.password.length === envPasscode.length &&
        crypto.timingSafeEqual(Buffer.from(parsed.data.password), Buffer.from(envPasscode));
      if (!matchesEnv) {
        return res.status(401).json({ error: 'Invalid administrator passcode.' });
      }

      const [existing] = await db.select().from(users).where(eq(users.email, email));
      let adminUser: typeof users.$inferSelect;
      if (existing) {
        const [updated] = await db
          .update(users)
          .set({ role: 'admin', status: 'active', updatedAt: new Date() })
          .where(eq(users.id, existing.id))
          .returning();
        adminUser = updated;
      } else {
        const [created] = await db
          .insert(users)
          .values({
            fullName: parsed.data.fullName || 'Store Administrator',
            email,
            phone: '+256 772 480 120',
            role: 'admin',
            status: 'active',
          })
          .returning();
        adminUser = created;
      }

      const safeUser = sanitizeUser(adminUser);
      return res.json({ user: safeUser, token: signLocalToken(safeUser) });
    }

    // One-time first-run admin claim when ADMIN_PASSCODE is unset
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    if (admins.some((a) => Boolean(a.passwordHash))) {
      return res.status(409).json({
        error: 'Administrator password has already been claimed. Please sign in normally.',
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    let adminUser: typeof users.$inferSelect;
    if (existing) {
      const [updated] = await db
        .update(users)
        .set({
          fullName: parsed.data.fullName || existing.fullName,
          passwordHash,
          role: 'admin',
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();
      adminUser = updated;
    } else {
      const [created] = await db
        .insert(users)
        .values({
          fullName: parsed.data.fullName || 'Kabale Branch Admin',
          email,
          phone: '+256 772 480 120',
          passwordHash,
          role: 'admin',
          status: 'active',
        })
        .returning();
      adminUser = created;
    }

    await db.insert(auditLogs).values({
      actorUserId: adminUser.id,
      actorEmail: adminUser.email,
      action: 'ADMIN_BOOTSTRAP_CLAIMED',
      entityType: 'user',
      entityId: String(adminUser.id),
    });

    const safeUser = sanitizeUser(adminUser);
    res.status(201).json({ user: safeUser, token: signLocalToken(safeUser) });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.authUser });
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
});

authRouter.patch('/profile', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile details' });
    }

    const [updated] = await db
      .update(users)
      .set({
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.authUser!.id))
      .returning();

    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.json({ ok: true });
});
