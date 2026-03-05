import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { authenticate, requirePermission } from '../middleware/auth';

export const patientsRouter = Router();

patientsRouter.use(authenticate);

// GET /api/patients — search & list patients
patientsRouter.get('/', requirePermission('calls:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string | undefined;
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const skip = (page - 1) * limit;

    const where: any = { active: true };

    if (q) {
      const search = q.trim();
      where.OR = [
        { mrn: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search.replace(/[\s\-\(\)]/g, '') } },
        { email: { contains: search } },
      ];
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { calls: true } } },
      }),
      prisma.patient.count({ where }),
    ]);

    res.json({
      data: patients.map((p) => ({
        ...p,
        tags: JSON.parse(p.tags),
        callCount: p._count.calls,
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch patients', statusCode: 500 });
  }
});

// GET /api/patients/:id — patient detail with call history
patientsRouter.get('/:id', requirePermission('calls:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        calls: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            category: { select: { name: true } },
            agent: { select: { name: true } },
          },
        },
      },
    });

    if (!patient) {
      res.status(404).json({ error: 'Not Found', message: 'Patient not found', statusCode: 404 });
      return;
    }

    res.json({
      ...patient,
      tags: JSON.parse(patient.tags),
      calls: patient.calls.map((c) => ({
        ...c,
        categoryName: c.category.name,
        agentName: c.agent.name,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch patient', statusCode: 500 });
  }
});

// POST /api/patients — create patient
patientsRouter.post('/', requirePermission('calls:create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { mrn, firstName, lastName, dob, phone, phoneAlt, email, preferredLanguage, insuranceProvider, insuranceId, notes, tags } = req.body;

    if (!mrn || !firstName || !lastName || !phone) {
      res.status(400).json({ error: 'Bad Request', message: 'mrn, firstName, lastName, and phone are required', statusCode: 400 });
      return;
    }

    const existing = await prisma.patient.findUnique({ where: { mrn } });
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: `Patient with MRN ${mrn} already exists`, statusCode: 409 });
      return;
    }

    const patient = await prisma.patient.create({
      data: {
        mrn,
        firstName,
        lastName,
        dob: dob ? new Date(dob) : null,
        phone: phone.replace(/[\s\-\(\)]/g, ''),
        phoneAlt: phoneAlt?.replace(/[\s\-\(\)]/g, '') || null,
        email: email || null,
        preferredLanguage: preferredLanguage || 'en',
        insuranceProvider: insuranceProvider || null,
        insuranceId: insuranceId || null,
        notes: notes || null,
        tags: JSON.stringify(tags || []),
      },
    });

    res.status(201).json({ ...patient, tags: JSON.parse(patient.tags) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create patient', statusCode: 500 });
  }
});

// PATCH /api/patients/:id — update patient
patientsRouter.patch('/:id', requirePermission('calls:create'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { firstName, lastName, dob, phone, phoneAlt, email, preferredLanguage, insuranceProvider, insuranceId, notes, tags, active } = req.body;

    const data: any = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (dob !== undefined) data.dob = dob ? new Date(dob) : null;
    if (phone !== undefined) data.phone = phone.replace(/[\s\-\(\)]/g, '');
    if (phoneAlt !== undefined) data.phoneAlt = phoneAlt?.replace(/[\s\-\(\)]/g, '') || null;
    if (email !== undefined) data.email = email || null;
    if (preferredLanguage !== undefined) data.preferredLanguage = preferredLanguage;
    if (insuranceProvider !== undefined) data.insuranceProvider = insuranceProvider;
    if (insuranceId !== undefined) data.insuranceId = insuranceId;
    if (notes !== undefined) data.notes = notes;
    if (tags !== undefined) data.tags = JSON.stringify(tags);
    if (active !== undefined) data.active = active;

    const patient = await prisma.patient.update({ where: { id }, data });
    res.json({ ...patient, tags: JSON.parse(patient.tags) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update patient', statusCode: 500 });
  }
});

// GET /api/patients/lookup/:phone — find patient by phone (for call auto-match)
patientsRouter.get('/lookup/:phone', requirePermission('calls:read'), async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = (req.params.phone as string).replace(/[\s\-\(\)]/g, '');
    const patients = await prisma.patient.findMany({
      where: {
        active: true,
        OR: [
          { phone: { contains: phone } },
          { phoneAlt: { contains: phone } },
        ],
      },
      include: { _count: { select: { calls: true } } },
      take: 5,
    });

    res.json(patients.map((p) => ({
      ...p,
      tags: JSON.parse(p.tags),
      callCount: p._count.calls,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to lookup patient', statusCode: 500 });
  }
});

// POST /api/patients/import — batch CSV import
patientsRouter.post('/import', requirePermission('users:manage'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { patients: rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'patients array is required', statusCode: 400 });
      return;
    }

    if (rows.length > 10000) {
      res.status(400).json({ error: 'Bad Request', message: 'Maximum 10,000 patients per import', statusCode: 400 });
      return;
    }

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as any[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.mrn || !row.firstName || !row.lastName || !row.phone) {
        results.errors.push({ row: rowNum, mrn: row.mrn, error: 'Missing required fields: mrn, firstName, lastName, phone' });
        results.skipped++;
        continue;
      }

      try {
        const existing = await prisma.patient.findUnique({ where: { mrn: String(row.mrn) } });

        const data = {
          firstName: String(row.firstName).trim(),
          lastName: String(row.lastName).trim(),
          dob: row.dob ? new Date(row.dob) : null,
          phone: String(row.phone).replace(/[\s\-\(\)]/g, ''),
          phoneAlt: row.phoneAlt ? String(row.phoneAlt).replace(/[\s\-\(\)]/g, '') : null,
          email: row.email ? String(row.email).trim() : null,
          preferredLanguage: row.preferredLanguage || 'en',
          insuranceProvider: row.insuranceProvider ? String(row.insuranceProvider).trim() : null,
          insuranceId: row.insuranceId ? String(row.insuranceId).trim() : null,
          notes: row.notes ? String(row.notes).trim() : null,
          tags: JSON.stringify(row.tags || []),
        };

        if (existing) {
          await prisma.patient.update({ where: { mrn: String(row.mrn) }, data });
          results.updated++;
        } else {
          await prisma.patient.create({ data: { mrn: String(row.mrn).trim(), ...data } });
          results.created++;
        }
      } catch (err: any) {
        results.errors.push({ row: rowNum, mrn: row.mrn, error: err.message });
        results.skipped++;
      }
    }

    res.json({
      total: rows.length,
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors.slice(0, 100), // cap error output
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Import failed', statusCode: 500 });
  }
});
