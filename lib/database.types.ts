/**
 * Hand-authored database types mirroring the Phase 2 migration
 * (supabase/migrations/20260812000001). Shaped like `supabase gen types` output
 * so the Supabase client is fully typed (`.from('households')`, `.rpc(...)`).
 *
 * Keep in sync with migrations. When the CLI is wired up later, this can be
 * replaced by generated output.
 */

export type HouseholdRole = 'owner' | 'admin' | 'member' | 'viewer';
export type MemberStatus = 'active' | 'removed';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  country_code: string | null;
  locale: string | null;
  language: string | null;
  currency_code: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface HouseholdRow {
  id: string;
  name: string;
  reporting_currency_code: string;
  is_cross_border: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMemberRow {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  status: MemberStatus;
  joined_at: string;
}

export interface HouseholdInvitationRow {
  id: string;
  household_id: string;
  email: string;
  role: HouseholdRole;
  token: string;
  status: InvitationStatus;
  invited_by: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

// --- Phase 3: finance core -------------------------------------------------
export type AccountType = 'cash' | 'bank' | 'card' | 'wallet' | 'other';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type FlowDirection = 'in' | 'out';
export type CategoryKind = 'income' | 'expense';

export interface AccountRow {
  id: string;
  household_id: string;
  name: string;
  type: AccountType;
  currency_code: string;
  opening_balance_minor: number;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  household_id: string;
  name: string;
  kind: CategoryKind;
  parent_id: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  household_id: string;
  account_id: string;
  type: TransactionType;
  direction: FlowDirection;
  amount_minor: number;
  currency_code: string;
  category_id: string | null;
  description: string | null;
  occurred_at: string;
  transfer_group_id: string | null;
  fx_rate: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountBalanceRow {
  account_id: string;
  household_id: string;
  currency_code: string;
  balance_minor: number;
}

// --- Phase 3 slice 3b: budgets / goals / debts -----------------------------
export interface BudgetRow {
  id: string;
  household_id: string;
  name: string;
  currency_code: string;
  period_start: string;
  period_end: string;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetAllocationRow {
  id: string;
  budget_id: string;
  household_id: string;
  category_id: string | null;
  limit_minor: number;
  account_id: string | null; // funding account (money-model #3); null = unassigned
  created_at: string;
}

export interface BudgetStatusRow {
  allocation_id: string;
  budget_id: string;
  household_id: string;
  category_id: string | null;
  currency_code: string;
  limit_minor: number;
  spent_minor: number;
  account_id: string | null;
}

export interface SavingsGoalRow {
  id: string;
  household_id: string;
  name: string;
  currency_code: string;
  target_minor: number;
  target_date: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalContributionRow {
  id: string;
  goal_id: string;
  household_id: string;
  amount_minor: number;
  occurred_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SavingsGoalStatusRow {
  goal_id: string;
  household_id: string;
  currency_code: string;
  target_minor: number;
  saved_minor: number;
}

export interface DebtRow {
  id: string;
  household_id: string;
  name: string;
  currency_code: string;
  principal_minor: number;
  apr: number | null;
  due_day: number | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtPaymentRow {
  id: string;
  debt_id: string;
  household_id: string;
  amount_minor: number;
  occurred_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DebtStatusRow {
  debt_id: string;
  household_id: string;
  currency_code: string;
  principal_minor: number;
  paid_minor: number;
  balance_minor: number;
}

// --- Phase 3 slice 3c: FX rate snapshots -----------------------------------
export interface FxRateSnapshotRow {
  id: string;
  household_id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  as_of: string;
  source: string;
  created_by: string | null;
  created_at: string;
}

export interface LatestFxRateRow {
  household_id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  as_of: string;
  source: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      households: {
        Row: HouseholdRow;
        Insert: {
          name: string;
          reporting_currency_code: string;
          created_by: string;
          id?: string;
          is_cross_border?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<HouseholdRow>;
        Relationships: [];
      };
      household_members: {
        Row: HouseholdMemberRow;
        Insert: {
          household_id: string;
          user_id: string;
          role?: HouseholdRole;
          status?: MemberStatus;
          joined_at?: string;
        };
        Update: Partial<HouseholdMemberRow>;
        Relationships: [];
      };
      household_invitations: {
        Row: HouseholdInvitationRow;
        Insert: {
          household_id: string;
          email: string;
          invited_by: string;
          id?: string;
          role?: HouseholdRole;
          token?: string;
          status?: InvitationStatus;
          expires_at?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: Partial<HouseholdInvitationRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_household: {
        Args: {
          _name: string;
          _reporting_currency_code: string;
          _is_cross_border?: boolean;
        };
        Returns: HouseholdRow;
      };
      accept_invitation: {
        Args: { _token: string };
        Returns: HouseholdMemberRow;
      };
    };
    Enums: {
      household_role: HouseholdRole;
    };
    CompositeTypes: Record<string, never>;
  };
}

// --- Phase 4: shared shopping (grocery) ------------------------------------
export type GroceryListStatus = 'active' | 'completed' | 'archived';

export interface GroceryListRow {
  id: string;
  household_id: string;
  name: string;
  currency_code: string;
  status: GroceryListStatus;
  completed_at: string | null;
  completed_transaction_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroceryItemRow {
  id: string;
  list_id: string;
  household_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  estimated_price_minor: number | null;
  actual_price_minor: number | null;
  is_purchased: boolean;
  added_by: string | null;
  purchased_by: string | null;
  purchased_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// --- Phase 5 (5a): retail foundation ---------------------------------------
export interface RetailerRow {
  id: string;
  household_id: string;
  name: string;
  country_code: string | null;
  website: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Global, read-only seeded directory backing "Add retailer" (5a). */
export interface RetailerDirectoryRow {
  id: string;
  country_code: string;
  name: string;
  kind: string | null;
  brand_key: string;
  created_at: string;
}

export interface RetailerStoreRow {
  id: string;
  household_id: string;
  retailer_id: string;
  name: string;
  street: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  currency_code: string;
  is_online: boolean;
  timezone: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  household_id: string;
  name: string;
  brand: string | null;
  gtin: string | null;
  upc: string | null;
  ean: string | null;
  size_value: number | null;
  size_unit: string | null;
  pack_count: number;
  category: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetailerProductRow {
  id: string;
  household_id: string;
  product_id: string;
  retailer_id: string;
  retailer_sku: string | null;
  display_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceSnapshotRow {
  id: string;
  household_id: string;
  retailer_product_id: string;
  store_id: string | null;
  regular_price_minor: number;
  sale_price_minor: number | null;
  member_price_minor: number | null;
  currency_code: string;
  observed_at: string;
  valid_until: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
}

export interface SavedLocationRow {
  id: string;
  household_id: string;
  label: string;
  store_id: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Phase 5 (5b): coupons -------------------------------------------------
export type CouponDiscountType = 'fixed' | 'percent';

export interface CouponRow {
  id: string;
  household_id: string;
  retailer_id: string;
  retailer_product_id: string | null;
  title: string;
  code: string | null;
  source_url: string | null;
  notes: string | null;
  discount_type: CouponDiscountType;
  discount_amount_minor: number | null;
  discount_percent: number | null;
  currency_code: string | null;
  min_purchase_minor: number | null;
  max_discount_minor: number | null;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Phase 6 (6a): entitlements --------------------------------------------
export interface HouseholdSubscriptionRow {
  id: string;
  household_id: string;
  plan_code: 'free' | 'premium';
  status: 'active' | 'canceled' | 'expired';
  source: 'manual' | 'apple' | 'google' | 'stripe';
  current_period_end: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
