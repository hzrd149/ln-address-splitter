import lnbits from "./lnbits/client.js";
import { adminKey } from "./env.js";
import { LNURLPayMetadata } from "./types.js";
import { loadSplit, saveSplit } from "./db.js";

function humanFriendlyId(size: number) {
  const parts = "abcdefghijklmnopqrstuvqwxyz0123456789";
  var id = "";
  while (id.length < size) {
    id += parts[Math.floor(Math.random() * parts.length)];
  }
  return id;
}

export type Split = {
  name: string;
  payouts: [string, number][];
  metadata: LNURLPayMetadata;
};

export async function createSplit(name: string, payouts: [string, number][]) {
  const split: Split = {
    name,
    payouts,
    metadata: [["text/plain", `Split: ${name}`]],
  };

  await saveSplit(split);

  return split;
}

export async function payoutSplit(id: string, amount: number) {
  const split = await loadSplit(id);
  if (!id) throw new Error(`no split with id ${id}`);

  console.log(`Start payout ${id}`);

  const totalWeight = split.payouts.reduce((v, [_a, w]) => v + w, 0);

  for (const [address, weight] of split.payouts) {
    const payoutAmount = Math.floor((weight / totalWeight) * amount);
    let percent = (weight / totalWeight) * 100;
    console.log(
      `Paying ${address} ${percent.toFixed(2)}% (${payoutAmount} sats)`
    );

    let [name, domain] = address.split("@");
    const lnurl = `https://${domain}/.well-known/lnurlp/${name}`;
    const metadata = await fetch(lnurl).then((res) => res.json());
    const callbackUrl = new URL(metadata.callback);
    callbackUrl.searchParams.append("amount", String(payoutAmount * 1000));
    const { pr: payRequest } = await fetch(callbackUrl).then((res) =>
      res.json()
    );
    console.log("invoice", payRequest);
    const { error, data } = await lnbits.post("/api/v1/payments", {
      headers: {
        "X-Api-Key": adminKey,
      },
      params: {},
      body: {
        out: true,
        memo: `Split: ${id}, Paying ${address} ${weight}%`,
        bolt11: payRequest,
      },
    });
    if (error) {
      console.log(`Failed to pay ${address}`);
      console.log(error);
    } else console.log("Paid", data);
  }

  console.log(`Finished payout ${id}`);
}
