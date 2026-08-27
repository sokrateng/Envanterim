import { describe, expect, it } from "vitest";
import { parseUblInvoice, unitCount, unitPriceWithTax } from "./einvoice";
import { toFormValues } from "./invoice";

/** Gerçek bir e-Arşiv faturasının şekli (kısaltılmış UBL-TR). */
const UBL = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>TKN2026000000123</cbc:ID>
  <cbc:IssueDate>2026-03-14</cbc:IssueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>Teknosa İç ve Dış Ticaret A.Ş.</cbc:Name></cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="TRY">40400.50</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">15333.75</cbc:LineExtensionAmount>
    <cac:TaxTotal><cbc:TaxAmount currencyID="TRY">3066.75</cbc:TaxAmount></cac:TaxTotal>
    <cac:Item>
      <cbc:Name>Çamaşır Makinesi 9 kg</cbc:Name>
      <cbc:BrandName>Bosch</cbc:BrandName>
      <cac:SellersItemIdentification><cbc:ID>WGG24400TR</cbc:ID></cac:SellersItemIdentification>
    </cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="TRY">15333.75</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
  <cac:InvoiceLine>
    <cbc:ID>2</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">2</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">1666.66</cbc:LineExtensionAmount>
    <cac:TaxTotal><cbc:TaxAmount currencyID="TRY">333.34</cbc:TaxAmount></cac:TaxTotal>
    <cac:Item>
      <cbc:Name>Kablosuz Kulaklık</cbc:Name>
    </cac:Item>
  </cac:InvoiceLine>
</Invoice>`;

describe("unitPriceWithTax", () => {
  it("KDV'yi ekleyip miktara böler", () => {
    expect(unitPriceWithTax(1666.66, 333.34, 2)).toBe(1000);
  });

  it("vergi yoksa matrahı kullanır", () => {
    expect(unitPriceWithTax(500, null, 1)).toBe(500);
  });

  it("miktar yoksa ya da sıfırsa tek adet sayar", () => {
    expect(unitPriceWithTax(500, 100, null)).toBe(600);
    expect(unitPriceWithTax(500, 100, 0)).toBe(600);
  });

  it("kuruşa yuvarlar", () => {
    expect(unitPriceWithTax(10, 0, 3)).toBe(3.33);
  });

  it("tutar yoksa null", () => {
    expect(unitPriceWithTax(null, 100, 1)).toBeNull();
  });
});

describe("unitCount", () => {
  it("tam sayı miktarı kadar ekipman açar", () => {
    expect(unitCount(3)).toBe(3);
  });

  it("ondalık miktarı tek kayda indirir — kilo, metre olabilir", () => {
    expect(unitCount(2.5)).toBe(1);
  });

  it("üst sınırı aşmaz", () => {
    expect(unitCount(500)).toBe(10);
  });

  it("miktar yoksa tek kayıt", () => {
    expect(unitCount(null)).toBe(1);
    expect(unitCount(0)).toBe(1);
  });
});

describe("parseUblInvoice", () => {
  it("fatura başlığını okur", () => {
    const result = parseUblInvoice(UBL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.sellerName).toBe("Teknosa İç ve Dış Ticaret A.Ş.");
    expect(result.invoice.invoiceDate).toBe("2026-03-14");
    expect(result.invoice.currency).toBe("TRY");
    expect(result.invoice.invoiceNumber).toBe("TKN2026000000123");
  });

  it("kalemleri KDV dahil birim fiyatla okur", () => {
    const result = parseUblInvoice(UBL);
    if (!result.ok) throw new Error(result.message);
    expect(result.invoice.lines).toHaveLength(2);

    const [makine, kulaklik] = result.invoice.lines;
    expect(makine).toMatchObject({
      name: "Çamaşır Makinesi 9 kg",
      brand: "Bosch",
      model: "WGG24400TR",
      serialNo: null,
      unitPrice: 18400.5,
      quantity: 1,
    });
    expect(kulaklik).toMatchObject({ name: "Kablosuz Kulaklık", unitPrice: 1000, quantity: 2 });
  });

  it("markası olmayan kalemde uydurmaz", () => {
    const result = parseUblInvoice(UBL);
    if (!result.ok) throw new Error(result.message);
    expect(result.invoice.lines[1].brand).toBeNull();
    expect(result.invoice.lines[1].model).toBeNull();
  });

  it("tek kalemli faturayı da okur (UBL'de dizi olmuyor)", () => {
    // İkinci kalemi çıkar: açılış etiketi doğrudan 2 numaralı kaleme bağlanmalı,
    // yoksa tembel eşleşme birinci kalemden başlayıp ikisini birden siler.
    const tek = UBL.replace(
      /<cac:InvoiceLine>\s*<cbc:ID>2<\/cbc:ID>[\s\S]*?<\/cac:InvoiceLine>/,
      "",
    );
    const result = parseUblInvoice(tek);
    if (!result.ok) throw new Error(result.message);
    expect(result.invoice.lines).toHaveLength(1);
  });

  it("PartyName yoksa ticaret unvanına düşer", () => {
    const alternatif = UBL.replace(
      "<cac:PartyName><cbc:Name>Teknosa İç ve Dış Ticaret A.Ş.</cbc:Name></cac:PartyName>",
      "<cac:PartyLegalEntity><cbc:RegistrationName>Vatan Bilgisayar A.Ş.</cbc:RegistrationName></cac:PartyLegalEntity>",
    );
    const result = parseUblInvoice(alternatif);
    if (!result.ok) throw new Error(result.message);
    expect(result.invoice.sellerName).toBe("Vatan Bilgisayar A.Ş.");
  });

  it("fatura olmayan XML'i reddeder", () => {
    const result = parseUblInvoice("<Rapor><Satir>1</Satir></Rapor>");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("e-Fatura");
  });

  it("bozuk metni reddeder", () => {
    const result = parseUblInvoice("bu bir xml değil");
    expect(result.ok).toBe(false);
  });

  it("kalemsiz faturayı reddeder", () => {
    const bos = UBL.replace(/<cac:InvoiceLine>[\s\S]*<\/cac:InvoiceLine>/, "");
    const result = parseUblInvoice(bos);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("kalem");
  });

  it("adı olmayan kalemi atlar", () => {
    const adsiz = UBL.replace("<cbc:Name>Kablosuz Kulaklık</cbc:Name>", "");
    const result = parseUblInvoice(adsiz);
    if (!result.ok) throw new Error(result.message);
    expect(result.invoice.lines).toHaveLength(1);
  });
});

describe("faturadan okuma ile aynı forma bağlanıyor", () => {
  it("XML sonucu doğrudan forma dönüşüyor", () => {
    const result = parseUblInvoice(UBL);
    if (!result.ok) throw new Error(result.message);

    const values = toFormValues(result.invoice, result.invoice.lines[0]);
    expect(values).toMatchObject({
      name: "Çamaşır Makinesi 9 kg",
      brand: "Bosch",
      model: "WGG24400TR",
      purchaseDate: "2026-03-14",
      purchasePrice: "18.400,50",
      sellerName: "Teknosa İç ve Dış Ticaret A.Ş.",
      // UBL kaleminde garanti süresi yok: fatura tarihinden 24 ay varsayılıyor
      // ve varsayım olduğu işaretleniyor.
      warrantyEndDate: "2028-03-14",
      warrantyAssumed: true,
    });
  });
});
