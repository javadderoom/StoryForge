import 'dotenv/config';
import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/storyforge?schema=public',
  },
});
