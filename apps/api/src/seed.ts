import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: 'General Inquiry' }, update: {}, create: { name: 'General Inquiry', description: 'General questions and information' } }),
    prisma.category.upsert({ where: { name: 'Billing' }, update: {}, create: { name: 'Billing', description: 'Billing and payment issues' } }),
    prisma.category.upsert({ where: { name: 'Technical Support' }, update: {}, create: { name: 'Technical Support', description: 'Technical issues and troubleshooting' } }),
    prisma.category.upsert({ where: { name: 'Complaints' }, update: {}, create: { name: 'Complaints', description: 'Customer complaints' } }),
    prisma.category.upsert({ where: { name: 'Follow-Up' }, update: {}, create: { name: 'Follow-Up', description: 'Follow-up on previous calls' } }),
  ]);

  // Create users
  const password = await bcrypt.hash('password123', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@ligare.com' },
    update: {},
    create: { email: 'owner@ligare.com', password, name: 'Thomas Rocas', role: 'OWNER', team: 'HH' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ligare.com' },
    update: {},
    create: { email: 'admin@ligare.com', password, name: 'Admin User', role: 'ADMIN', team: 'HH' },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@ligare.com' },
    update: {},
    create: { email: 'supervisor@ligare.com', password, name: 'Sarah Chen', role: 'SUPERVISOR', team: 'HH' },
  });

  const agent1 = await prisma.user.upsert({
    where: { email: 'agent1@ligare.com' },
    update: {},
    create: { email: 'agent1@ligare.com', password, name: 'Mike Johnson', role: 'AGENT', team: 'HH' },
  });

  const agent2 = await prisma.user.upsert({
    where: { email: 'agent2@ligare.com' },
    update: {},
    create: { email: 'agent2@ligare.com', password, name: 'Lisa Park', role: 'AGENT', team: 'HO' },
  });

  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@ligare.com' },
    update: {},
    create: { email: 'auditor@ligare.com', password, name: 'Audit User', role: 'AUDITOR', team: 'HH' },
  });

  // Create sample patients
  const patients = await Promise.all([
    prisma.patient.upsert({ where: { mrn: 'MRN-1001' }, update: {}, create: { mrn: 'MRN-1001', firstName: 'John', lastName: 'Doe', dob: new Date('1985-06-15'), phone: '5550101', email: 'john.doe@email.com', insuranceProvider: 'Blue Cross', insuranceId: 'BC-45678', tags: '["VIP"]' } }),
    prisma.patient.upsert({ where: { mrn: 'MRN-1002' }, update: {}, create: { mrn: 'MRN-1002', firstName: 'Jane', lastName: 'Smith', dob: new Date('1990-03-22'), phone: '5550102', phoneAlt: '5550199', email: 'jane.smith@email.com', insuranceProvider: 'Aetna', insuranceId: 'AE-11223', preferredLanguage: 'en', notes: 'Prefers morning calls', tags: '["Follow-up needed"]' } }),
    prisma.patient.upsert({ where: { mrn: 'MRN-1003' }, update: {}, create: { mrn: 'MRN-1003', firstName: 'Bob', lastName: 'Wilson', dob: new Date('1975-11-08'), phone: '5550103', insuranceProvider: 'Cigna', insuranceId: 'CG-99887', tags: '[]' } }),
    prisma.patient.upsert({ where: { mrn: 'MRN-1004' }, update: {}, create: { mrn: 'MRN-1004', firstName: 'Alice', lastName: 'Brown', dob: new Date('1968-01-30'), phone: '5550104', email: 'alice.b@email.com', insuranceProvider: 'UnitedHealth', insuranceId: 'UH-55432', preferredLanguage: 'es', notes: 'Spanish-speaking patient', tags: '["Spanish","Hard of hearing"]' } }),
    prisma.patient.upsert({ where: { mrn: 'MRN-1005' }, update: {}, create: { mrn: 'MRN-1005', firstName: 'Eva', lastName: 'Martinez', dob: new Date('1995-09-12'), phone: '5550106', email: 'eva.m@email.com', insuranceProvider: 'Blue Cross', insuranceId: 'BC-78901', tags: '["VIP","Priority"]' } }),
  ]);

  // Create sample calls
  const now = new Date();
  const calls = [
    { callerName: 'John Doe', callerPhone: '555-0101', categoryId: categories[0].id, patientId: patients[0].id, priority: 'MEDIUM', status: 'COMPLETED', team: 'HH', agentId: agent1.id, startedAt: new Date(now.getTime() - 3600000), completedAt: new Date(now.getTime() - 3300000), duration: 300, notes: 'Answered general inquiry about services', reason: 'Insurance verification', disposition: 'Resolved' },
    { callerName: 'Jane Smith', callerPhone: '555-0102', categoryId: categories[1].id, patientId: patients[1].id, priority: 'HIGH', status: 'IN_PROGRESS', team: 'HH', agentId: agent1.id, startedAt: new Date(now.getTime() - 600000), notes: 'Billing dispute — reviewing account', reason: 'Billing inquiry', hipaaAcknowledged: true },
    { callerName: 'Bob Wilson', callerPhone: '555-0103', categoryId: categories[2].id, patientId: patients[2].id, priority: 'URGENT', status: 'QUEUED', team: 'HO', agentId: agent2.id, notes: 'System outage reported', reason: 'Portal access issue' },
    { callerName: 'Alice Brown', callerPhone: '555-0104', categoryId: categories[3].id, patientId: patients[3].id, priority: 'HIGH', status: 'COMPLETED', team: 'HO', agentId: agent2.id, startedAt: new Date(now.getTime() - 7200000), completedAt: new Date(now.getTime() - 6600000), duration: 600, notes: 'Complaint resolved — credited account', reason: 'Service complaint', disposition: 'Resolved — account credited', hipaaAcknowledged: true },
    { callerName: 'Charlie Davis', callerPhone: '555-0105', categoryId: categories[4].id, priority: 'LOW', status: 'MISSED', team: 'HH', agentId: agent1.id, notes: 'Follow-up call — no answer', reason: 'Scheduled follow-up' },
    { callerName: 'Eva Martinez', callerPhone: '555-0106', categoryId: categories[0].id, patientId: patients[4].id, priority: 'MEDIUM', status: 'QUEUED', team: 'HH', agentId: supervisor.id, notes: 'VIP client requesting callback', reason: 'Callback request', followUpDate: new Date(now.getTime() + 86400000), followUpAssignedTo: agent1.id },
    { callerName: 'Frank Lee', callerPhone: '555-0107', categoryId: categories[1].id, priority: 'MEDIUM', status: 'COMPLETED', team: 'HO', agentId: agent2.id, startedAt: new Date(now.getTime() - 5400000), completedAt: new Date(now.getTime() - 5100000), duration: 300, notes: 'Payment plan setup', reason: 'Payment arrangement', disposition: 'Resolved — payment plan created' },
    { callerName: 'Grace Kim', callerPhone: '555-0108', categoryId: categories[2].id, priority: 'HIGH', status: 'TRANSFERRED', team: 'HH', agentId: agent1.id, transferredToId: supervisor.id, transferNotes: 'Escalated — needs supervisor review', reason: 'Complex technical issue' },
  ];

  for (const call of calls) {
    await prisma.call.create({ data: call });
  }

  console.log('✅ Seeded:');
  console.log(`   ${patients.length} patients`);
  console.log(`   ${categories.length} categories`);
  console.log(`   6 users (password: password123)`);
  console.log(`   ${calls.length} sample calls`);
  console.log('\n📧 Login accounts:');
  console.log('   owner@ligare.com / password123 (OWNER)');
  console.log('   admin@ligare.com / password123 (ADMIN)');
  console.log('   supervisor@ligare.com / password123 (SUPERVISOR)');
  console.log('   agent1@ligare.com / password123 (AGENT)');
  console.log('   agent2@ligare.com / password123 (AGENT)');
  console.log('   auditor@ligare.com / password123 (AUDITOR)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
