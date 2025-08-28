import Bull from 'bull';
import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const s3Client = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'worker.log' }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

const cleanupQueue = new Bull('cleanup', process.env.REDIS_URL!);
const notificationQueue = new Bull('notifications', process.env.REDIS_URL!);

cleanupQueue.process(async (job) => {
  const { projectId } = job.data as { projectId: string };
  logger.info(`Processing cleanup for project ${projectId}`);

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { files: true },
    });

    if (!project) {
      logger.warn(`Project ${projectId} not found`);
      return;
    }

    for (const file of project.files) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: file.s3Key,
          })
        );
        logger.info(`Deleted S3 file: ${file.s3Key}`);
      } catch (error) {
        logger.error(`Failed to delete S3 file: ${file.s3Key}`, error as any);
      }
    }

    await prisma.project.delete({ where: { id: projectId } });
    logger.info(`Deleted project ${projectId} from database`);
  } catch (error) {
    logger.error(`Cleanup failed for project ${projectId}:`, error as any);
    throw error;
  }
});

notificationQueue.process(async (job) => {
  const { type, data } = job.data as any;
  switch (type) {
    case 'expiry-warning':
      logger.info(`Sending expiry warning for project ${data.projectId}`);
      break;
    case 'project-expired':
      logger.info(`Project ${data.projectId} has expired`);
      await cleanupQueue.add({ projectId: data.projectId }, { delay: 7 * 24 * 60 * 60 * 1000 });
      break;
  }
});

async function checkExpiredProjects() {
  try {
    const expiredProjects = await prisma.project.findMany({
      where: { expiresAt: { lte: new Date() }, isPaid: false },
    });

    for (const project of expiredProjects) {
      await notificationQueue.add({ type: 'project-expired', data: { projectId: project.id } });
    }

    logger.info(`Checked ${expiredProjects.length} expired projects`);
  } catch (error) {
    logger.error('Error checking expired projects:', error as any);
  }
}

setInterval(checkExpiredProjects, 60 * 60 * 1000);

logger.info('Worker started');
