import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import Redis from 'redis';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import winston from 'winston';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const redis = Redis.createClient({ url: process.env.REDIS_URL });

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Multer S3 upload
const upload = multer({
  storage: multerS3({
    s3: s3Client as any,
    bucket: process.env.S3_BUCKET!,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const projectId = (req.params as any).projectId;
      const fileKey = `projects/${projectId}/${Date.now()}-${file.originalname}`;
      cb(null, fileKey);
    },
  }) as any,
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Project routes
app.post('/api/projects', async (req, res) => {
  try {
    const auth = (req.headers.authorization || '').split(' ')[1];
    const { data } = await supabase.auth.getUser(auth);

    const project = await prisma.project.create({
      data: {
        userId: (data?.user?.id as string) || 'anonymous',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: (req.body as any).metadata || {},
      },
    });

    // Set expiration in Redis (24h)
    await redis.connect();
    await redis.setEx(`project:${project.id}`, 86400, JSON.stringify(project));
    await redis.disconnect();

    res.json(project);
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    await redis.connect();
    const cached = await redis.get(`project:${req.params.id}`);
    if (cached) {
      await redis.disconnect();
      return res.json(JSON.parse(cached));
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { files: true },
    });

    if (!project) {
      await redis.disconnect();
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.expiresAt < new Date()) {
      await redis.disconnect();
      return res.status(410).json({ error: 'Project has expired' });
    }

    await redis.setEx(`project:${req.params.id}`, 3600, JSON.stringify(project));
    await redis.disconnect();

    res.json(project);
  } catch (error) {
    logger.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.post('/api/projects/:projectId/files', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as any[];

    const fileRecords = await Promise.all(
      files.map(file =>
        prisma.file.create({
          data: {
            projectId: req.params.projectId,
            name: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            url: file.location,
            s3Key: file.key,
          },
        })
      )
    );

    res.json(fileRecords);
  } catch (error) {
    logger.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

app.post('/api/payments/extend', async (req, res) => {
  try {
    const { projectId, plan } = req.body as any;

    const prices: Record<string, { amount: number; days: number }> = {
      'extend-7': { amount: 499, days: 7 },
      'extend-30': { amount: 1499, days: 30 },
      'extend-permanent': { amount: 4999, days: 36500 },
    };

    const selectedPlan = prices[plan];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `OneDay.run Project Extension - ${selectedPlan.days} days`,
              description: `Extend project ${projectId} for ${selectedPlan.days} days`,
            },
            unit_amount: selectedPlan.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/project/${projectId}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/project/${projectId}?payment=cancelled`,
      metadata: { projectId, days: String(selectedPlan.days) },
    });

    res.json({ sessionUrl: session.url });
  } catch (error) {
    logger.error('Error creating payment session:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

import type { Request, Response } from 'express';
import type StripeTypes from 'stripe';
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }) as any,
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    try {
      const event = stripe.webhooks.constructEvent(
        (req as any).body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      if ((event as StripeTypes.Event).type === 'checkout.session.completed') {
        const session = (event as StripeTypes.Event).data.object as StripeTypes.Checkout.Session;
        const { projectId, days } = session.metadata!;

        await prisma.project.update({
          where: { id: projectId },
          data: {
            expiresAt: new Date(Date.now() + parseInt(days!) * 24 * 60 * 60 * 1000),
            isPaid: true,
          },
        });
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook error:', error);
      res.status(400).send('Webhook Error');
    }
  }
);

// SVG export endpoint (placeholder)
app.get('/api/projects/:id/export', async (req, res) => {
  res.status(501).json({ error: 'Not implemented in this demo' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
