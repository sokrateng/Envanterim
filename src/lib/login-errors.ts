/**
 * Giriş sırasında `authorize`'ın fırlattığı hata kodu. İstemci ile sunucu aynı
 * metni paylaşsın diye ayrı, bağımlılıksız bir dosyada: form bunu içe aktarırken
 * sunucuya özel hiçbir şey pakete girmesin.
 *
 * Kilit, girilen kullanıcı adına göre tutuluyor; hesap var mı yok mu bakılmıyor.
 * Var olmayan bir ad da aynı denemeden sonra aynı kilidi görür, yani bu kod
 * hesap varlığı hakkında bilgi vermez.
 */
export const LOGIN_LOCKED = "LOGIN_LOCKED";
