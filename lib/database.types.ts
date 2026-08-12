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
  created_by: string;
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
  created_by: string;
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
  created_by: string;
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
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetAllocationRow {
  id: string;
  budget_id: string;
  household_id: string;
  category_id: string | null;
  limit_minor: number;
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
}

export interface SavingsGoalRow {
  id: string;
  household_id: string;
  name: string;
  currency_code: string;
  target_minor: number;
  target_date: string | null;
  is_archived: boolean;
  created_by: string;
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
  created_by: string;
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
  created_by: string;
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
  created_by: string;
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
  created_by: string;
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
