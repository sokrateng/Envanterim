/**
 * Kameradaki okuma penceresinin video pikselindeki karşılığı — saf ve testli.
 *
 * Video `object-cover` ile gösteriliyor: yatay bir kamera karesi (1920×1080)
 * dikey bir kutuya (390×520) sığdırılırken kenarlardan kırpılıyor. Kullanıcının
 * gördüğü çerçeveyi video oranlarıyla hesaplamak bu yüzden yanlış sonuç
 * veriyordu — çerçeve geniş ve kısa görünürken çözümleme bambaşka bir alana
 * bakıyordu (TUZAKLAR #65).
 */

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

/**
 * `window` kutuya oranla verilir (0–1). `zoom` pencereyi daraltıyor: kırpılan
 * alan küçüldükçe kodun piksel yoğunluğu artıyor.
 */
export function coverWindow(
  video: Size,
  box: Size,
  window: Size,
  zoom = 1,
): Rect {
  if (video.width <= 0 || video.height <= 0 || box.width <= 0 || box.height <= 0) {
    return { x: 0, y: 0, width: Math.max(0, video.width), height: Math.max(0, video.height) };
  }

  // object-cover: kutuyu dolduran en küçük ölçek.
  const scale = Math.max(box.width / video.width, box.height / video.height);
  const factor = Math.max(1, zoom);

  const width = Math.min(video.width, (box.width * window.width) / factor / scale);
  const height = Math.min(video.height, (box.height * window.height) / factor / scale);

  return {
    x: Math.round((video.width - width) / 2),
    y: Math.round((video.height - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}
