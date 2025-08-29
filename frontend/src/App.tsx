import { PricingPage } from "./components/PricingPage";
import { SolanaProvider } from "./context/SolanaProvider";
import { TransactionToastProvider } from "./context/TransactionToastContext";
import "./index.css";

export function App() {
  return (
    <SolanaProvider>
      <TransactionToastProvider>
        <PricingPage />
      </TransactionToastProvider>
    </SolanaProvider>
  );
}

export default App;
