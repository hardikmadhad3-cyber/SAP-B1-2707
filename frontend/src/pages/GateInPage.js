import GatePassTransactionForm from '../modules/gate-pass/GatePassTransactionForm';
import { GATE_PASS_TRANSACTIONS } from '../modules/gate-pass/gatePassTransactions';

export default function GateInPage() {
  return <GatePassTransactionForm transaction={GATE_PASS_TRANSACTIONS.gateIn} />;
}
