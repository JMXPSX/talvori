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
