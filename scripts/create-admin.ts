/**
 * İlk hesabı açar. Üretime giriş yapacak kimse olmadan dağıtmayın
 * (docs/MIMARI.md §8 adım 6).
 *
 *   npm run create-admin                       → sorarak
 *   npm run create-admin -- ad kullanıcı şifre → doğrudan
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { usernameSchema } from "../src/lib/validation";

const prisma = new PrismaClient();

async function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  if (hidden) {
    // Şifre terminalde görünmesin: yazılan karakterler ekrana basılmaz.
    const output = rl as unknown as { output?: { write: (s: string) => void } };
    const original = output.output?.write;
    if (output.output && original) {
      output.output.write = (chunk: string) => {
        if (!chunk.includes(question)) return;
        original.call(output.output, chunk);
      };
    }
  }
  const answer = await rl.question(question);
  rl.close();
  if (hidden) stdout.write("\n");
  return answer.trim();
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL tanımsız. .env dosyasını .env.example'dan kopyalayın.",
    );
    process.exit(1);
  }

  const [argName, argUsername, argPassword] = process.argv.slice(2);

  const name = argName || (await ask("Ad soyad: "));
  const rawUsername = argUsername || (await ask("Kullanıcı adı: "));
  const password = argPassword || (await ask("Şifre: ", true));

  const parsedUsername = usernameSchema.safeParse(rawUsername);
  if (!parsedUsername.success) {
    console.error(parsedUsername.error.issues[0]?.message ?? "Geçersiz kullanıcı adı");
    process.exit(1);
  }
  if (!name) {
    console.error("Ad boş olamaz.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Şifre en az 8 karakter olmalı.");
    process.exit(1);
  }

  const username = parsedUsername.data;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.error(`"${username}" zaten var.`);
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      status: "ACTIVE",
    },
    select: { id: true, username: true },
  });

  console.log(`Hesap açıldı: @${user.username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
