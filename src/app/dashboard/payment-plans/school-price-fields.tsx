"use client";

import { useState } from "react";

type SchoolStage = { label: string; percent: number };

export function SchoolPriceFields({ stages, sampleAmounts }: { stages: readonly SchoolStage[]; sampleAmounts: readonly number[] }) {
  const [currency, setCurrency] = useState<"KES" | "USD">("KES");
  const [kesAmounts, setKesAmounts] = useState(() => sampleAmounts.map(String));
  const [usdAmounts, setUsdAmounts] = useState(["", "", ""]);
  const amounts = currency === "KES" ? kesAmounts : usdAmounts;
  return <>
    <label>Currency<select name="currency" value={currency} onChange={(event) => {
      setCurrency(event.target.value as "KES" | "USD");
    }}><option value="KES">KES · Kenya shillings</option><option value="USD">USD · US dollars</option></select></label>
    <div className="school-stage-inputs"><p>{currency === "KES" ? "Example KES amounts · editable." : "Enter the school’s USD amounts. KES example amounts are kept separate; no exchange-rate conversion is applied."} The entered amounts set each stage’s share.</p>{stages.map((stage, index) => <label key={stage.label}>Stage {index + 1} · sample share {stage.percent}%<input name={`stage${index + 1}Amount`} type="number" min="0.01" max="100000000" step="0.01" value={amounts[index] ?? ""} onChange={(event) => {
      const update = currency === "KES" ? setKesAmounts : setUsdAmounts;
      update((current) => current.map((amount, amountIndex) => amountIndex === index ? event.target.value : amount));
    }} placeholder={currency === "USD" ? "Enter USD amount" : "Enter amount in KES"} required /><small>{stage.label}</small></label>)}</div>
  </>;
}
