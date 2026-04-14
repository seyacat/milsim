import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../src/database/data-source';
import { User } from '../src/auth/entities/user.entity';

async function upsert(
  repo: ReturnType<typeof AppDataSource.getRepository<User>>,
  email: string,
  name: string,
  password: string,
) {
  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists (id=${existing.id})`);
    return;
  }
  const user = repo.create({
    email,
    name,
    password: await bcrypt.hash(password, 10),
  });
  await repo.save(user);
  console.log(`Created ${email} (id=${user.id}) with password '${password}'`);
}

async function run() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  await upsert(repo, 'admin@admin.com', 'admin', 'admin');
  await upsert(repo, 'player1@test.com', 'player1', 'player1');
  await upsert(repo, 'player2@test.com', 'player2', 'player2');

  await AppDataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
