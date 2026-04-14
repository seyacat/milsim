import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../src/database/data-source';
import { User } from '../src/auth/entities/user.entity';

async function run() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  const email = 'admin@admin.com';
  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists (id=${existing.id})`);
    await AppDataSource.destroy();
    return;
  }

  const user = repo.create({
    email,
    name: 'admin',
    password: await bcrypt.hash('admin', 10),
  });
  await repo.save(user);
  console.log(`Created ${email} (id=${user.id}) with password 'admin'`);
  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
