import { Database } from "bun:sqlite";

// Database instance - using in-memory for development, can be changed to file-based
const db = new Database(":memory:", { 
  create: true,
  strict: true 
});

// Initialize database tables
function initializeDatabase() {
  // Create payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_hash TEXT UNIQUE NOT NULL,
      wallet_address TEXT NOT NULL,
      amount_usdc REAL NOT NULL,
      payment_date TEXT NOT NULL,
      subscription_duration_days INTEGER DEFAULT 30,
      subscription_end_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create subscriptions table
  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      subscription_end_date TEXT,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_wallet ON payments(wallet_address)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_wallet ON subscriptions(wallet_address)`);

  console.log('Database initialized successfully');
}

// Initialize database when module is loaded
initializeDatabase();

// Types for our database entities
export interface Payment {
  id?: number;
  transaction_hash: string;
  wallet_address: string;
  amount_usdc: number;
  payment_date: Date;
  subscription_duration_days?: number;
  subscription_end_date?: Date;
  status: 'pending' | 'confirmed' | 'failed';
  created_at?: Date;
  updated_at?: Date;
}

export interface Subscription {
  id?: number;
  wallet_address: string;
  subscription_end_date?: Date;
  last_updated?: Date;
  created_at?: Date;
}

/**
 * Adds a new payment record to the database
 */
export async function addPayment(payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
  try {
    const stmt = db.prepare(`
      INSERT INTO payments (
        transaction_hash, 
        wallet_address, 
        amount_usdc, 
        payment_date, 
        subscription_duration_days,
        subscription_end_date,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const subscription_end_date = new Date(payment.payment_date);
    subscription_end_date.setDate(subscription_end_date.getDate() + (payment.subscription_duration_days || 30));

    const result = stmt.run(
      payment.transaction_hash,
      payment.wallet_address,
      payment.amount_usdc,
      payment.payment_date.toISOString(),
      payment.subscription_duration_days || 30,
      subscription_end_date.toISOString(),
      payment.status
    );

    // Update or create subscription record
    await updateSubscription(payment.wallet_address, subscription_end_date);

    return result.changes > 0;
  } catch (error) {
    console.error(`Error adding payment: ${error}`);
    return false;
  }
}

/**
 * Updates payment status after confirmation
 */
export async function updatePaymentStatus(
  transaction_hash: string, 
  status: 'confirmed' | 'failed'
): Promise<boolean> {
  try {
    const stmt = db.prepare(`
      UPDATE payments 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE transaction_hash = ?
    `);

    const result = stmt.run(status, transaction_hash);
    return result.changes > 0;
  } catch (error) {
    console.error(`Error updating payment status: ${error}`);
    return false;
  }
}

/**
 * Updates or creates subscription record
 */
export async function updateSubscription(
  wallet_address: string, 
  subscription_end_date: Date
): Promise<boolean> {
  try {
    const stmt = db.prepare(`
      INSERT INTO subscriptions (wallet_address, subscription_end_date, last_updated)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(wallet_address) 
      DO UPDATE SET 
        subscription_end_date = excluded.subscription_end_date,
        last_updated = CURRENT_TIMESTAMP
    `);

    const result = stmt.run(wallet_address, subscription_end_date.toISOString());
    return result.changes > 0;
  } catch (error) {
    console.error(`Error updating subscription: ${error}`);
    return false;
  }
}

/**
 * Gets payment by transaction hash
 */
export async function getPaymentByTransactionHash(transaction_hash: string): Promise<Payment | null> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM payments WHERE transaction_hash = ?
    `);

    const result = stmt.get(transaction_hash) as any;
    if (!result) return null;

    return {
      ...result,
      payment_date: new Date(result.payment_date),
      subscription_end_date: result.subscription_end_date ? new Date(result.subscription_end_date) : undefined,
      created_at: result.created_at ? new Date(result.created_at) : undefined,
      updated_at: result.updated_at ? new Date(result.updated_at) : undefined,
    } as Payment;
  } catch (error) {
    console.error(`Error getting payment: ${error}`);
    return null;
  }
}

/**
 * Gets all payments for a wallet address
 */
export async function getPaymentsByWallet(wallet_address: string): Promise<Payment[]> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM payments 
      WHERE wallet_address = ? 
      ORDER BY payment_date DESC
    `);

    const results = stmt.all(wallet_address) as any[];
    
    return results.map(result => ({
      ...result,
      payment_date: new Date(result.payment_date),
      subscription_end_date: result.subscription_end_date ? new Date(result.subscription_end_date) : undefined,
      created_at: result.created_at ? new Date(result.created_at) : undefined,
      updated_at: result.updated_at ? new Date(result.updated_at) : undefined,
    })) as Payment[];
  } catch (error) {
    console.error(`Error getting payments by wallet: ${error}`);
    return [];
  }
}

/**
 * Gets subscription by wallet address
 */
export async function getSubscriptionByWallet(wallet_address: string): Promise<Subscription | null> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM subscriptions WHERE wallet_address = ?
    `);

    const result = stmt.get(wallet_address) as any;
    if (!result) return null;

    return {
      ...result,
      subscription_end_date: result.subscription_end_date ? new Date(result.subscription_end_date) : undefined,
      last_updated: result.last_updated ? new Date(result.last_updated) : undefined,
      created_at: result.created_at ? new Date(result.created_at) : undefined,
    } as Subscription;
  } catch (error) {
    console.error(`Error getting subscription: ${error}`);
    return null;
  }
}

/**
 * Legacy function for backward compatibility - now uses SQLite
 */
export async function addSubscriptionPayment(
  wallet_address: string,
  transaction_hash: string,
  amount_usdc: number,
  payment_date: Date,
  subscription_duration_days: number = 30
): Promise<boolean> {
  try {
    const payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'> = {
      transaction_hash,
      wallet_address,
      amount_usdc,
      payment_date,
      subscription_duration_days,
      status: 'pending'
    };

    return await addPayment(payment);
  } catch (error) {
    console.error(`Error adding subscription payment: ${error}`);
    return false;
  }
}

/**
 * Close database connection (useful for cleanup)
 */
export function closeDatabase() {
  db.close();
}

// Export the database instance for direct access if needed
export { db };
  