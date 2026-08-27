import Link from "next/link";
import { Screen, ScreenHeader } from "@/components/ui";
import { currentUser } from "@/lib/session";

/**
 * Görülemeyen ekipman.
 *
 * Olmayan ekipmanla "var ama senin değil" aynı cevabı alıyor: ayrı cevaplar
 * verseydik, elinde bir kimlik olan yabancı hangi kimliğin gerçek olduğunu
 * deneyerek öğrenirdi. Bu yüzden metin ikisini de kapsıyor.
 *
 * Ama sessiz bir 404 kullanıcıyı yanlış yere bakmaya itiyor: etiketi okutup
 * buraya düşen kişi çoğu zaman ikinci cihazında başka bir hesapla girişli.
 * Kiminle girişli olduğunu söylemek sızıntı değil — kendi bilgisi — ve
 * sorunun cevabı çoğu zaman orada.
 */
export default async function EkipmanBulunamadi() {
  const user = await currentUser();

  return (
    <Screen>
      <ScreenHeader title="Ekipman açılamadı" back={{ href: "/envanter", label: "Envanter" }} />

      <div className="px-4 pt-2">
        <p className="text-body">
          Bu ekipman yok ya da bağlı olduğu lokasyonun üyesi değilsin.
        </p>

        {user ? (
          <p className="pt-3 text-subheadline text-muted">
            Şu an{" "}
            <span className="text-ink">
              {user.name ?? user.username} (@{user.username})
            </span>{" "}
            olarak girişlisin. QR etiketi başka bir hesabın envanterine aitse
            önce o hesapla giriş yapman gerekiyor.
          </p>
        ) : null}

        <div className="pt-5">
          <Link
            href="/envanter"
            className="grid min-h-touch place-items-center rounded-card bg-blue px-4 text-headline text-white transition active:scale-95"
          >
            Envantere dön
          </Link>
          <Link
            href="/hesap"
            className="grid min-h-touch place-items-center pt-3 text-body text-blue active:opacity-60"
          >
            Hesabı değiştir
          </Link>
        </div>
      </div>
    </Screen>
  );
}
