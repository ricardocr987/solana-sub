import { PricingPage } from "./components/PricingPage";
import { TransactionToastProvider } from "./context/TransactionToastContext";
import { WalletProvider } from "./context/WalletContext";
import { TransactionHistory } from "./components/TransactionHistory";
import { Toaster } from "./components/ui/toaster";
import "./index.css";

export function App() {
  return (
    <WalletProvider>
      <TransactionToastProvider>
        <PricingPage />
      </TransactionToastProvider>
      <Toaster />
    </WalletProvider>
  );
}

export default App;
