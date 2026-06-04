export interface Call {
  id: string;
  createdAt: number;   // ms
  targetAt: number;    // ms (createdAt + 7 days)
  spotAtPick: number;
  userUp: boolean;
  modelPup: number;
}

export function priceAt(prices: { t: number; price: number }[], ts: number): number | null {
  for (const p of prices) if (p.t >= ts) return p.price;
  return null;
}

export function resolveCall(call: Call, prices: { t: number; price: number }[]) {
  const px = priceAt(prices, call.targetAt);
  if (px === null) return { resolved: false, actualUp: false, userRight: false, modelRight: false };
  const actualUp = px > call.spotAtPick;
  const modelUp = call.modelPup >= 0.5;
  return { resolved: true, actualUp, userRight: call.userUp === actualUp, modelRight: modelUp === actualUp };
}
