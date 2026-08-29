/** Build a dynamic UPI payment QR image pre-filled with the exact order amount. */
export function upiQrImage(upiId: string, amount: number, note?: string) {
  const id = String(upiId ?? "").trim();
  if (!id || !id.includes("@")) return null;
  const link = `upi://pay?pa=${encodeURIComponent(id)}&pn=${encodeURIComponent("Mealbox91")}&am=${Number(amount || 0).toFixed(2)}&cu=INR${
    note ? `&tn=${encodeURIComponent(note)}` : ""
  }`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(link)}`;
}
