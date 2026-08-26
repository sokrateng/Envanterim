"use client";

import { useState } from "react";
import { suggestEmoji, type EmojiSet } from "@/lib/emoji";

/**
 * İkon seçimi: hazır liste + elle yazma.
 *
 * Telefonda emoji klavyesini açıp aramak yavaş; yazılan ada göre sıralanmış
 * bir şerit üç dokunuşta bitiyor. Liste kapalı bir küme değil — istediğini
 * yazabilmek için alan hâlâ duruyor.
 */
export function EmojiField({
  name,
  defaultValue,
  set,
  nameValue,
  label = "İkon",
}: {
  name: string;
  defaultValue?: string | null;
  set: EmojiSet;
  /** Yazılmakta olan ad; öneriler buna göre sıralanıyor. */
  nameValue?: string;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const suggestions = suggestEmoji(nameValue ?? "", set);

  return (
    <div className="px-4 pb-3">
      <label className="block pb-1 text-footnote text-muted" htmlFor={`${name}-input`}>
        {label}
      </label>

      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid h-touch w-touch shrink-0 place-items-center rounded-card border border-separator bg-surface text-title"
        >
          {value || "—"}
        </span>
        <input
          id={`${name}-input`}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={8}
          placeholder="Listeden seç ya da yaz"
          className="w-full rounded-card border border-separator bg-surface px-3 py-2.5 text-body outline-none focus:border-blue"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            className="min-h-touch shrink-0 px-2 text-subheadline text-red active:opacity-60"
          >
            Kaldır
          </button>
        ) : null}
      </div>

      {/* Yatay şerit: dikey ızgara paneli uzatıp kaydet düğmesini ekrandan
          çıkarıyordu. */}
      <div
        role="radiogroup"
        aria-label={`${label} önerileri`}
        className="mt-2 flex gap-1.5 overflow-x-auto pb-1"
      >
        {suggestions.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="radio"
            aria-checked={value === emoji}
            aria-label={emoji}
            onClick={() => setValue(emoji)}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-card text-title transition active:scale-90 ${
              value === emoji ? "bg-blue/15 ring-2 ring-blue" : "bg-bg"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
