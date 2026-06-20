# Interactive Land Sale Walkthrough

In terminal 1:

```bash
npm run node
```

In terminal 2:

```bash
npm run land -- --network localhost
```

Choose option **1** first. The menu stays open after successful actions, bad input, and reverted transactions. Type `0` to exit. If an action fails, read the reason, correct it, and continue.

The complete menu code is in `scripts/land-cli.js`. It is commented in simple language. Read one function at a time: each menu option points to one function instead of putting every idea in one giant block.

## Why an error does not close the menu

This small part is the safety net:

```javascript
// Try the action chosen from the menu.
try {
  await actions[choice]();
} catch (error) {
  // Explain the problem, then let the while-loop show the menu again.
  console.error(`Action failed: ${friendlyError(error)}`);
  console.error("Nothing crashed—you can correct the input and try again.");
}
```

Where it belongs: inside the `while (true)` loop near the bottom of `scripts/land-cli.js`.

Why it matters: one bad answer or rejected contract action should stop only that action, not the whole lesson.

## Fast complete demonstration

Choose **11. Run a complete demo**. It uses account 0 as registrar, account 1 as seller, account 2 as buyer, a fresh land ID, and a price of 1 ETH.

The purchase moves 1 ETH from the buyer into escrow. Registrar approval changes ownership, records the transfer in `LandHistory`, and releases the ETH to the seller. Every printed transaction includes its hash and mined block.

Then use:

- option 3 to compare user and escrow balances;
- option 8 to inspect ownership and sale state;
- option 9 to see the transfer record;
- option 10 to see the blocks created by transactions.

## Manual role-by-role demonstration

1. Choose **4 — Register land**. Use account 0 as registrar, a unique numeric land ID, and account 1 as first owner.
2. Choose **5 — List land**. Use account 1, the same land ID, and a price such as `1` ETH.
3. Choose **6 — Buy land**. Use account 2 and the same land ID. The console sends the exact listed price.
4. Choose **3 — Balances**. Escrow holds the payment while approval is pending.
5. Choose **7 — Approve sale**. Use account 0 and the same land ID.
6. Choose **3 — Balances** again. Escrow is empty because the seller was paid.
7. Use options 8, 9, and 10 to inspect the land, history, and blocks.

## More users and land

Hardhat supplies several local accounts. Choose any unused account as another owner or buyer and repeat options 4–7 with a unique land ID. Option 3 acts as the local address book.

The current contract marks land as sold after one completed sale, so it cannot be relisted. Repeat sales, cancelling a purchase, changing registrar, or refunding a rejected purchase need deliberate Solidity changes and tests. Add one contract feature at a time, then expose it as another menu option.

## Error experiments

Try a wrong role deliberately:

- register or approve with an account other than 0: `NotRegistrar`;
- list with someone other than the owner: `NotLandOwner`;
- buy using the owner: `OwnerCannotBuyOwnLand`;
- approve before anyone buys: `NoPendingBuyer`.

These reverts do not change contract state. The console reports the error and returns to its menu.
