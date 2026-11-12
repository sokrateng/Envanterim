import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { LOGIN_LOCKED } from "@/lib/login-errors";
import {
  clientAddress,
  loginBlockReason,
  startLoginAttempt,
} from "@/lib/login-limit";
import { prisma } from "@/lib/prisma";

const MAX_USERNAME_LENGTH = 64;

// Geçerli biçimde (60 karakter, cost 10) sahte bir hash. Geçersiz biçimli hash
// bcryptjs'te hiç iş yapmadan false döner; o zaman var olmayan kullanıcı
// milisaniyede yanıt alır ve kullanıcı adı sayımı mümkün olurdu.
const DUMMY_HASH = bcrypt.hashSync("zamanlama-icin-sahte-parola", 10);

// Kullanıcı adı + şifre. E-posta doğrulama ve OAuth yok: sistem davetle büyüyor
// (MIMARI §1).
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/giris" },
  providers: [
    CredentialsProvider({
      name: "Kullanıcı adı",
      credentials: {
        username: { label: "Kullanıcı adı", type: "text" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials, req) {
        const username = credentials?.username?.trim().toLowerCase();
        const password = credentials?.password;
        if (!username || !password) return null;
        // Anahtar olarak bellekte tutuluyor: uzunluk sınırsız olmasın.
        if (username.length > MAX_USERNAME_LENGTH) return null;

        // Kilitliyken şifre doğru olsa da giriş yok: yoksa kilit, doğru tahmini
        // ayırt etmenin yolu olurdu. Hash karşılaştırmasına hiç girmiyoruz.
        // Deneme, bcrypt beklenirken de sayılıyor (eşzamanlı istek seli).
        const address = clientAddress(req?.headers);
        const attempt = startLoginAttempt(username, address);
        if (!attempt) {
          // Kayıtta "kilit mi, şifre mi yanlış" ayırt edilebilsin. Kullanıcı adı
          // dışarıdan geliyor: JSON ile basıp satır sonu enjekte edilmesini önlüyoruz.
          console.warn(
            "giriş kilitli",
            JSON.stringify({
              kullanici: username,
              adres: address,
              neden: loginBlockReason(username, address),
            }),
          );
          // Form "şifre hatalı" yerine bekleme mesajı gösterebilsin diye ayrı kod.
          throw new Error(LOGIN_LOCKED);
        }

        try {
          const user = await prisma.user.findUnique({ where: { username } });
          // Kullanıcı yoksa da gerçek bir hash'le karşılaştırıyoruz: aynı
          // süreyi harcamak "bu ad var mı" sorusunu zamanlamayla yanıtlatmaz.
          const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
          if (!user || !ok || user.status !== "ACTIVE") {
            attempt.fail();
            return null;
          }

          attempt.succeed();
          return { id: user.id, name: user.name, username: user.username };
        } catch (error) {
          // Veritabanı hatası da denemeyi açık bırakmasın.
          attempt.fail();
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.username = (user as { username?: string }).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
};
