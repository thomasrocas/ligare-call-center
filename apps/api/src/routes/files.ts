import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

export const filesRouter = Router();

filesRouter.use(authenticate);

// Configure multer storage
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg',
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// POST /api/files/upload — upload a file
filesRouter.post(
  '/upload',
  requirePermission('files:upload'),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Bad Request', message: 'No file uploaded', statusCode: 400 });
        return;
      }

      const callId = req.body.callId as string | undefined;
      const patientId = req.body.patientId as string | undefined;

      // Validate callId/patientId if provided
      if (callId) {
        const call = await prisma.call.findUnique({ where: { id: callId } });
        if (!call) {
          fs.unlinkSync(req.file.path); // clean up
          res.status(404).json({ error: 'Not Found', message: 'Call not found', statusCode: 404 });
          return;
        }
      }

      if (patientId) {
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) {
          fs.unlinkSync(req.file.path); // clean up
          res.status(404).json({ error: 'Not Found', message: 'Patient not found', statusCode: 404 });
          return;
        }
      }

      const attachment = await prisma.fileAttachment.create({
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
          callId: callId || null,
          patientId: patientId || null,
          uploadedBy: req.user!.id,
        },
        include: {
          uploader: { select: { id: true, name: true } },
        },
      }) as any;

      await logAudit(
        'FILE_UPLOADED',
        req.user!.id,
        callId,
        `File uploaded: ${req.file.originalname} (${req.file.size} bytes)`,
        patientId
      );

      res.status(201).json({
        id: attachment.id,
        filename: attachment.filename,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        callId: attachment.callId,
        patientId: attachment.patientId,
        uploadedBy: attachment.uploadedBy,
        uploaderName: attachment.uploader.name,
        createdAt: attachment.createdAt,
      });
    } catch (err: any) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (err.message?.includes('File type not allowed')) {
        res.status(415).json({ error: 'Unsupported Media Type', message: err.message, statusCode: 415 });
        return;
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Payload Too Large', message: 'File exceeds 50MB limit', statusCode: 413 });
        return;
      }
      res.status(500).json({ error: 'Internal Server Error', message: 'Upload failed', statusCode: 500 });
    }
  }
);

// GET /api/files — list files with optional filters
filesRouter.get('/', requirePermission('files:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const callId = req.query['callId'] as string | undefined;
    const patientId = req.query['patientId'] as string | undefined;

    const where: any = {};
    if (callId) where.callId = callId;
    if (patientId) where.patientId = patientId;

    const files = await prisma.fileAttachment.findMany({
      where,
      include: { uploader: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }) as any[];

    res.json(files.map((f: any) => ({
      id: f.id,
      filename: f.filename,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      callId: f.callId,
      patientId: f.patientId,
      uploadedBy: f.uploadedBy,
      uploaderName: f.uploader.name,
      createdAt: f.createdAt,
    })));
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list files', statusCode: 500 });
  }
});

// GET /api/files/:id/download — download a file
filesRouter.get('/:id/download', requirePermission('files:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const file = await prisma.fileAttachment.findUnique({ where: { id } });
    if (!file) {
      res.status(404).json({ error: 'Not Found', message: 'File not found', statusCode: 404 });
      return;
    }

    if (!fs.existsSync(file.path)) {
      res.status(404).json({ error: 'Not Found', message: 'File data not found on disk', statusCode: 404 });
      return;
    }

    await logAudit('FILE_DOWNLOADED', req.user!.id, file.callId || undefined, `File downloaded: ${file.originalName}`);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size);
    fs.createReadStream(file.path).pipe(res);
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Download failed', statusCode: 500 });
  }
});

// GET /api/files/:id — file metadata
filesRouter.get('/:id', requirePermission('files:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const file = await prisma.fileAttachment.findUnique({
      where: { id },
      include: { uploader: { select: { id: true, name: true } } },
    }) as any;
    if (!file) {
      res.status(404).json({ error: 'Not Found', message: 'File not found', statusCode: 404 });
      return;
    }
    res.json({
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      callId: file.callId,
      patientId: file.patientId,
      uploadedBy: file.uploadedBy,
      uploaderName: file.uploader.name,
      createdAt: file.createdAt,
    });
  } catch {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch file metadata', statusCode: 500 });
  }
});

// DELETE /api/files/:id — delete file
filesRouter.delete('/:id', requirePermission('files:upload'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const file = await prisma.fileAttachment.findUnique({ where: { id } });
    if (!file) {
      res.status(404).json({ error: 'Not Found', message: 'File not found', statusCode: 404 });
      return;
    }

    // Only uploader, admin, or owner can delete
    if (file.uploadedBy !== req.user!.id && !['OWNER', 'ADMIN'].includes(req.user!.role)) {
      res.status(403).json({ error: 'Forbidden', message: 'Cannot delete file uploaded by another user', statusCode: 403 });
      return;
    }

    await prisma.fileAttachment.delete({ where: { id } });

    // Remove from disk
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    await logAudit('FILE_DELETED', req.user!.id, file.callId || undefined, `File deleted: ${file.originalName}`);
    res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Not Found', message: 'File not found', statusCode: 404 });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete file', statusCode: 500 });
  }
});
