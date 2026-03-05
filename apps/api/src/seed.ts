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

  // Create sample calls
  const now = new Date();
  const calls = [
    { callerName: 'John Doe', callerPhone: '555-0101', categoryId: categories[0].id, priority: 'MEDIUM', status: 'COMPLETED', team: 'HH', agentId: agent1.id, startedAt: new Date(now.getTime() - 3600000), completedAt: new Date(now.getTime() - 3300000), duration: 300, notes: 'Answered general inquiry about services' },
    { callerName: 'Jane Smith', callerPhone: '555-0102', categoryId: categories[1].id, priority: 'HIGH', status: 'IN_PROGRESS', team: 'HH', agentId: agent1.id, startedAt: new Date(now.getTime() - 600000), notes: 'Billing dispute — reviewing account' },
    { callerName: 'Bob Wilson', callerPhone: '555-0103', categoryId: categories[2].id, priority: 'URGENT', status: 'QUEUED', team: 'HO', agentId: agent2.id, notes: 'System outage reported' },
    { callerName: 'Alice Brown', callerPhone: '555-0104', categoryId: categories[3].id, priority: 'HIGH', status: 'COMPLETED', team: 'HO', agentId: agent2.id, startedAt: new Date(now.getTime() - 7200000), completedAt: new Date(now.getTime() - 6600000), duration: 600, notes: 'Complaint resolved — credited account' },
    { callerName: 'Charlie Davis', callerPhone: '555-0105', categoryId: categories[4].id, priority: 'LOW', status: 'MISSED', team: 'HH', agentId: agent1.id, notes: 'Follow-up call — no answer' },
    { callerName: 'Eva Martinez', callerPhone: '555-0106', categoryId: categories[0].id, priority: 'MEDIUM', status: 'QUEUED', team: 'HH', agentId: supervisor.id, notes: 'VIP client requesting callback' },
    { callerName: 'Frank Lee', callerPhone: '555-0107', categoryId: categories[1].id, priority: 'MEDIUM', status: 'COMPLETED', team: 'HO', agentId: agent2.id, startedAt: new Date(now.getTime() - 5400000), completedAt: new Date(now.getTime() - 5100000), duration: 300, notes: 'Payment plan setup' },
    { callerName: 'Grace Kim', callerPhone: '555-0108', categoryId: categories[2].id, priority: 'HIGH', status: 'TRANSFERRED', team: 'HH', agentId: agent1.id, transferredToId: supervisor.id, transferNotes: 'Escalated — needs supervisor review' },
  ];

  for (const call of calls) {
    await prisma.call.create({ data: call });
  }

  console.log('✅ Seeded:');
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
