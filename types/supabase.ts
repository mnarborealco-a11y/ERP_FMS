export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      approval_cycles: {
        Row: {
          client_round_number: number
          company_id: string
          created_at: string
          cycle_id: string
          cycle_type: Database["public"]["Enums"]["cycle_type_t"]
          decided_at: string | null
          decided_by: string | null
          decision: Database["public"]["Enums"]["cycle_decision_t"]
          decision_notes: string | null
          founder_iteration_number: number | null
          matter_id: string
          scored_point: boolean
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          client_round_number?: number
          company_id: string
          created_at?: string
          cycle_id?: string
          cycle_type: Database["public"]["Enums"]["cycle_type_t"]
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["cycle_decision_t"]
          decision_notes?: string | null
          founder_iteration_number?: number | null
          matter_id: string
          scored_point?: boolean
          submitted_at: string
          submitted_by?: string | null
        }
        Update: {
          client_round_number?: number
          company_id?: string
          created_at?: string
          cycle_id?: string
          cycle_type?: Database["public"]["Enums"]["cycle_type_t"]
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["cycle_decision_t"]
          decision_notes?: string | null
          founder_iteration_number?: number | null
          matter_id?: string
          scored_point?: boolean
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_cycles_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_cycles_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_cycles_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_cycles_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["matter_id"]
          },
          {
            foreignKeyName: "approval_cycles_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_cycles_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_cycles_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          color_primary: string | null
          color_secondary: string | null
          court_appearances_enabled: boolean
          created_at: string
          id: string
          logo_url: string | null
          matters_enabled: boolean
          max_users: number
          name: string
          slug: string
          status: Database["public"]["Enums"]["company_status_t"]
          tasks_enabled: boolean
          updated_at: string
          works_saturday: boolean
          works_sunday: boolean
        }
        Insert: {
          color_primary?: string | null
          color_secondary?: string | null
          court_appearances_enabled?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          matters_enabled?: boolean
          max_users?: number
          name: string
          slug: string
          status?: Database["public"]["Enums"]["company_status_t"]
          tasks_enabled?: boolean
          updated_at?: string
          works_saturday?: boolean
          works_sunday?: boolean
        }
        Update: {
          color_primary?: string | null
          color_secondary?: string | null
          court_appearances_enabled?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          matters_enabled?: boolean
          max_users?: number
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["company_status_t"]
          tasks_enabled?: boolean
          updated_at?: string
          works_saturday?: boolean
          works_sunday?: boolean
        }
        Relationships: []
      }
      company_workflow_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          company_id: string
          id: string
          is_active: boolean
          tat_mode: Database["public"]["Enums"]["tat_mode_t"]
          workflow_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          company_id: string
          id?: string
          is_active?: boolean
          tat_mode?: Database["public"]["Enums"]["tat_mode_t"]
          workflow_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          company_id?: string
          id?: string
          is_active?: boolean
          tat_mode?: Database["public"]["Enums"]["tat_mode_t"]
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_workflow_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_workflow_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_workflow_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_workflow_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_workflow_assignments_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      court_appearances: {
        Row: {
          appearance_date: string
          appearance_id: string
          company_id: string
          court_name: string
          created_at: string
          employee_id: string
          matter_id: string
          note: string | null
        }
        Insert: {
          appearance_date: string
          appearance_id?: string
          company_id: string
          court_name: string
          created_at?: string
          employee_id: string
          matter_id: string
          note?: string | null
        }
        Update: {
          appearance_date?: string
          appearance_id?: string
          company_id?: string
          court_name?: string
          created_at?: string
          employee_id?: string
          matter_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "court_appearances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_appearances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_appearances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_appearances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_appearances_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["matter_id"]
          },
        ]
      }
      holidays: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          date: string
          holiday_id: string
          label: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          date: string
          holiday_id?: string
          label?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          holiday_id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      independent_tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          company_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string
          original_due_at: string
          priority: Database["public"]["Enums"]["task_priority_t"]
          status: Database["public"]["Enums"]["task_status_t"]
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at: string
          original_due_at: string
          priority: Database["public"]["Enums"]["task_priority_t"]
          status?: Database["public"]["Enums"]["task_status_t"]
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string
          original_due_at?: string
          priority?: Database["public"]["Enums"]["task_priority_t"]
          status?: Database["public"]["Enums"]["task_status_t"]
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "independent_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "independent_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "independent_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "independent_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "independent_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "independent_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "independent_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      matter_steps: {
        Row: {
          assigned_employee_id: string | null
          client_round_number: number
          company_id: string
          completed_at: string | null
          created_at: string
          due_at: string | null
          matter_id: string
          started_at: string
          status: Database["public"]["Enums"]["step_status_t"]
          step_instance_id: string
          step_type: Database["public"]["Enums"]["step_type_t"]
          tat_unit: Database["public"]["Enums"]["tat_unit_t"] | null
          tat_value: number | null
        }
        Insert: {
          assigned_employee_id?: string | null
          client_round_number?: number
          company_id: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          matter_id: string
          started_at: string
          status?: Database["public"]["Enums"]["step_status_t"]
          step_instance_id?: string
          step_type: Database["public"]["Enums"]["step_type_t"]
          tat_unit?: Database["public"]["Enums"]["tat_unit_t"] | null
          tat_value?: number | null
        }
        Update: {
          assigned_employee_id?: string | null
          client_round_number?: number
          company_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          matter_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["step_status_t"]
          step_instance_id?: string
          step_type?: Database["public"]["Enums"]["step_type_t"]
          tat_unit?: Database["public"]["Enums"]["tat_unit_t"] | null
          tat_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matter_steps_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_steps_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_steps_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_steps_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["matter_id"]
          },
        ]
      }
      matter_tat_settings: {
        Row: {
          company_id: string
          created_at: string
          matter_id: string
          step_key: string
          unit: Database["public"]["Enums"]["tat_unit_t"]
          value: number
        }
        Insert: {
          company_id: string
          created_at?: string
          matter_id: string
          step_key: string
          unit: Database["public"]["Enums"]["tat_unit_t"]
          value: number
        }
        Update: {
          company_id?: string
          created_at?: string
          matter_id?: string
          step_key?: string
          unit?: Database["public"]["Enums"]["tat_unit_t"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "matter_tat_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matter_tat_settings_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["matter_id"]
          },
        ]
      }
      matters: {
        Row: {
          client_approved_in_current_round: boolean
          client_name: string | null
          client_round_counter: number
          company_id: string
          created_at: string
          created_by: string | null
          current_step: Database["public"]["Enums"]["matter_step_t"]
          employee_id: string
          founder_approved_in_current_round: boolean
          founder_id: string
          founder_iteration_counter: number
          matter_id: string
          status: Database["public"]["Enums"]["matter_status_t"]
          title: string
          type: Database["public"]["Enums"]["matter_type_t"]
          updated_at: string
        }
        Insert: {
          client_approved_in_current_round?: boolean
          client_name?: string | null
          client_round_counter?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          current_step?: Database["public"]["Enums"]["matter_step_t"]
          employee_id: string
          founder_approved_in_current_round?: boolean
          founder_id: string
          founder_iteration_counter?: number
          matter_id: string
          status?: Database["public"]["Enums"]["matter_status_t"]
          title: string
          type: Database["public"]["Enums"]["matter_type_t"]
          updated_at?: string
        }
        Update: {
          client_approved_in_current_round?: boolean
          client_name?: string | null
          client_round_counter?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_step?: Database["public"]["Enums"]["matter_step_t"]
          employee_id?: string
          founder_approved_in_current_round?: boolean
          founder_id?: string
          founder_iteration_counter?: number
          matter_id?: string
          status?: Database["public"]["Enums"]["matter_status_t"]
          title?: string
          type?: Database["public"]["Enums"]["matter_type_t"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matters_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          last_login_at: string | null
          name: string
          role: Database["public"]["Enums"]["role_t"]
          status: Database["public"]["Enums"]["user_status_t"]
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id: string
          last_login_at?: string | null
          name: string
          role: Database["public"]["Enums"]["role_t"]
          status?: Database["public"]["Enums"]["user_status_t"]
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          last_login_at?: string | null
          name?: string
          role?: Database["public"]["Enums"]["role_t"]
          status?: Database["public"]["Enums"]["user_status_t"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      score_ledger: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          employee_id: string
          event_type: Database["public"]["Enums"]["score_event_t"]
          ledger_id: string
          points: number
          ref_id: string
          ref_type: Database["public"]["Enums"]["score_ref_t"]
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          description?: string | null
          employee_id: string
          event_type: Database["public"]["Enums"]["score_event_t"]
          ledger_id?: string
          points?: number
          ref_id: string
          ref_type: Database["public"]["Enums"]["score_ref_t"]
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          employee_id?: string
          event_type?: Database["public"]["Enums"]["score_event_t"]
          ledger_id?: string
          points?: number
          ref_id?: string
          ref_type?: Database["public"]["Enums"]["score_ref_t"]
        }
        Relationships: [
          {
            foreignKeyName: "score_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_push_requests: {
        Row: {
          company_id: string
          current_due_at: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          initiated_by_role: Database["public"]["Enums"]["initiated_by_t"]
          push_request_id: string
          reason: string | null
          requested_at: string
          requested_by: string | null
          requested_due_at: string
          status: Database["public"]["Enums"]["push_status_t"]
          task_id: string
        }
        Insert: {
          company_id: string
          current_due_at: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          initiated_by_role: Database["public"]["Enums"]["initiated_by_t"]
          push_request_id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          requested_due_at: string
          status?: Database["public"]["Enums"]["push_status_t"]
          task_id: string
        }
        Update: {
          company_id?: string
          current_due_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          initiated_by_role?: Database["public"]["Enums"]["initiated_by_t"]
          push_request_id?: string
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          requested_due_at?: string
          status?: Database["public"]["Enums"]["push_status_t"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_push_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_push_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_push_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_push_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_push_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_push_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_push_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_push_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "independent_tasks"
            referencedColumns: ["task_id"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          company_id: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          from_employee_id: string
          matter_id: string
          reason: string
          requested_at: string
          requested_by: string
          status: Database["public"]["Enums"]["request_status_t"]
          to_employee_id: string
          transfer_request_id: string
        }
        Insert: {
          company_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          from_employee_id: string
          matter_id: string
          reason: string
          requested_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["request_status_t"]
          to_employee_id: string
          transfer_request_id?: string
        }
        Update: {
          company_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          from_employee_id?: string
          matter_id?: string
          reason?: string
          requested_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["request_status_t"]
          to_employee_id?: string
          transfer_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["matter_id"]
          },
          {
            foreignKeyName: "transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_role: Database["public"]["Enums"]["step_actor_role_t"]
          description: string | null
          entity_id_prefix: string
          entity_label: string
          id: string
          key: string
          name: string
          status: Database["public"]["Enums"]["workflow_definition_status_t"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_role: Database["public"]["Enums"]["step_actor_role_t"]
          description?: string | null
          entity_id_prefix: string
          entity_label: string
          id?: string
          key: string
          name: string
          status?: Database["public"]["Enums"]["workflow_definition_status_t"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_role?: Database["public"]["Enums"]["step_actor_role_t"]
          description?: string | null
          entity_id_prefix?: string
          entity_label?: string
          id?: string
          key?: string
          name?: string
          status?: Database["public"]["Enums"]["workflow_definition_status_t"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_field_definitions: {
        Row: {
          created_at: string
          field_type: Database["public"]["Enums"]["workflow_field_type_t"]
          id: string
          is_required: boolean
          key: string
          label: string
          options: Json | null
          order_index: number
          penalize_client_on_no: boolean
          references_workflow_id: string | null
          step_id: string | null
          updated_at: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          field_type: Database["public"]["Enums"]["workflow_field_type_t"]
          id?: string
          is_required?: boolean
          key: string
          label: string
          options?: Json | null
          order_index?: number
          penalize_client_on_no?: boolean
          references_workflow_id?: string | null
          step_id?: string | null
          updated_at?: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          field_type?: Database["public"]["Enums"]["workflow_field_type_t"]
          id?: string
          is_required?: boolean
          key?: string
          label?: string
          options?: Json | null
          order_index?: number
          penalize_client_on_no?: boolean
          references_workflow_id?: string | null
          step_id?: string | null
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_field_definitions_references_workflow_id_fkey"
            columns: ["references_workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_field_definitions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_field_definitions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instance_decisions: {
        Row: {
          company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: Database["public"]["Enums"]["cycle_decision_t"]
          decision_notes: string | null
          entry_number: number
          id: string
          instance_id: string
          instance_step_id: string
          scored_point: boolean
          step_id: string
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["cycle_decision_t"]
          decision_notes?: string | null
          entry_number?: number
          id?: string
          instance_id: string
          instance_step_id: string
          scored_point?: boolean
          step_id: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: Database["public"]["Enums"]["cycle_decision_t"]
          decision_notes?: string | null
          entry_number?: number
          id?: string
          instance_id?: string
          instance_step_id?: string
          scored_point?: boolean
          step_id?: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instance_decisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_decisions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_decisions_instance_step_id_fkey"
            columns: ["instance_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_instance_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_decisions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_decisions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_decisions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_decisions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instance_field_values: {
        Row: {
          company_id: string
          created_at: string
          field_id: string
          id: string
          instance_id: string
          instance_step_id: string | null
          updated_at: string
          value: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string
          field_id: string
          id?: string
          instance_id: string
          instance_step_id?: string | null
          updated_at?: string
          value?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          field_id?: string
          id?: string
          instance_id?: string
          instance_step_id?: string | null
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instance_field_values_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "workflow_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_field_values_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_field_values_instance_step_id_fkey"
            columns: ["instance_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_instance_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instance_steps: {
        Row: {
          assigned_client_id: string | null
          assigned_employee_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          due_at: string | null
          entry_number: number
          id: string
          instance_id: string
          started_at: string
          status: Database["public"]["Enums"]["step_status_t"]
          step_id: string
          tat_unit: Database["public"]["Enums"]["tat_unit_t"] | null
          tat_value: number | null
        }
        Insert: {
          assigned_client_id?: string | null
          assigned_employee_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          entry_number?: number
          id?: string
          instance_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["step_status_t"]
          step_id: string
          tat_unit?: Database["public"]["Enums"]["tat_unit_t"] | null
          tat_value?: number | null
        }
        Update: {
          assigned_client_id?: string | null
          assigned_employee_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          entry_number?: number
          id?: string
          instance_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["step_status_t"]
          step_id?: string
          tat_unit?: Database["public"]["Enums"]["tat_unit_t"] | null
          tat_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instance_steps_assigned_client_id_fkey"
            columns: ["assigned_client_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_assigned_client_id_fkey"
            columns: ["assigned_client_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_assigned_client_id_fkey"
            columns: ["assigned_client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_steps_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instance_tat_overrides: {
        Row: {
          company_id: string
          created_at: string
          instance_id: string
          step_id: string
          unit: Database["public"]["Enums"]["tat_unit_t"]
          value: number
        }
        Insert: {
          company_id: string
          created_at?: string
          instance_id: string
          step_id: string
          unit: Database["public"]["Enums"]["tat_unit_t"]
          value: number
        }
        Update: {
          company_id?: string
          created_at?: string
          instance_id?: string
          step_id?: string
          unit?: Database["public"]["Enums"]["tat_unit_t"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instance_tat_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_tat_overrides_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_tat_overrides_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instance_transfer_requests: {
        Row: {
          company_id: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          from_employee_id: string
          id: string
          instance_id: string
          reason: string
          requested_at: string
          requested_by: string
          status: Database["public"]["Enums"]["request_status_t"]
          to_employee_id: string
        }
        Insert: {
          company_id: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          from_employee_id: string
          id?: string
          instance_id: string
          reason: string
          requested_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["request_status_t"]
          to_employee_id: string
        }
        Update: {
          company_id?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          from_employee_id?: string
          id?: string
          instance_id?: string
          reason?: string
          requested_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["request_status_t"]
          to_employee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instance_transfer_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instance_transfer_requests_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          assigned_to: string
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          current_step_id: string | null
          id: string
          status: Database["public"]["Enums"]["matter_status_t"]
          title: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          assigned_to: string
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_step_id?: string | null
          id: string
          status?: Database["public"]["Enums"]["matter_status_t"]
          title: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          assigned_to?: string
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_step_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["matter_status_t"]
          title?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          actor_role: Database["public"]["Enums"]["step_actor_role_t"]
          created_at: string
          default_tat_unit: Database["public"]["Enums"]["tat_unit_t"] | null
          default_tat_value: number | null
          id: string
          is_entry_step: boolean
          key: string
          name: string
          next_step_id: string | null
          order_index: number
          reject_next_step_id: string | null
          requires_notes_on_reject: boolean
          scores_on_overdue: boolean
          scores_on_reentry: boolean
          step_kind: Database["public"]["Enums"]["step_kind_t"]
          updated_at: string
          workflow_id: string
        }
        Insert: {
          actor_role: Database["public"]["Enums"]["step_actor_role_t"]
          created_at?: string
          default_tat_unit?: Database["public"]["Enums"]["tat_unit_t"] | null
          default_tat_value?: number | null
          id?: string
          is_entry_step?: boolean
          key: string
          name: string
          next_step_id?: string | null
          order_index?: number
          reject_next_step_id?: string | null
          requires_notes_on_reject?: boolean
          scores_on_overdue?: boolean
          scores_on_reentry?: boolean
          step_kind: Database["public"]["Enums"]["step_kind_t"]
          updated_at?: string
          workflow_id: string
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["step_actor_role_t"]
          created_at?: string
          default_tat_unit?: Database["public"]["Enums"]["tat_unit_t"] | null
          default_tat_value?: number | null
          id?: string
          is_entry_step?: boolean
          key?: string
          name?: string
          next_step_id?: string | null
          order_index?: number
          reject_next_step_id?: string | null
          requires_notes_on_reject?: boolean
          scores_on_overdue?: boolean
          scores_on_reentry?: boolean
          step_kind?: Database["public"]["Enums"]["step_kind_t"]
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_next_step_id_fkey"
            columns: ["next_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_reject_next_step_id_fkey"
            columns: ["reject_next_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_clients: {
        Row: {
          id: string | null
          name: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      active_employees: {
        Row: {
          id: string | null
          name: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_working_days: {
        Args: { days: number; p_company_id: string; start_at: string }
        Returns: string
      }
      add_working_hours: {
        Args: { hours: number; p_company_id: string; start_at: string }
        Returns: string
      }
      admin_list_users: { Args: never; Returns: Json }
      admin_update_user: {
        Args: {
          p_name?: string
          p_role?: Database["public"]["Enums"]["role_t"]
          p_status?: Database["public"]["Enums"]["user_status_t"]
          p_user_id: string
        }
        Returns: Json
      }
      company_workflow_assign: {
        Args: {
          p_company_id: string
          p_tat_mode?: Database["public"]["Enums"]["tat_mode_t"]
          p_workflow_id: string
        }
        Returns: Json
      }
      company_workflow_unassign: {
        Args: { p_company_id: string; p_workflow_id: string }
        Returns: Json
      }
      complete_matter_step: {
        Args: {
          p_company_id: string
          p_matter_id: string
          p_reference_at?: string
          p_step_type: Database["public"]["Enums"]["step_type_t"]
        }
        Returns: {
          assigned_employee_id: string | null
          client_round_number: number
          company_id: string
          completed_at: string | null
          created_at: string
          due_at: string | null
          matter_id: string
          started_at: string
          status: Database["public"]["Enums"]["step_status_t"]
          step_instance_id: string
          step_type: Database["public"]["Enums"]["step_type_t"]
          tat_unit: Database["public"]["Enums"]["tat_unit_t"] | null
          tat_value: number | null
        }
        SetofOptions: {
          from: "*"
          to: "matter_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_due_at: {
        Args: {
          p_company_id: string
          start_at: string
          tat_unit: Database["public"]["Enums"]["tat_unit_t"]
          tat_value: number
        }
        Returns: string
      }
      court_appearances_create: {
        Args: {
          p_appearance_date: string
          p_court_name: string
          p_matter_id: string
          p_note?: string
        }
        Returns: Json
      }
      current_company_claim: { Args: never; Returns: string }
      current_role_claim: { Args: never; Returns: string }
      dashboard_admin: { Args: never; Returns: Json }
      dashboard_employee: { Args: never; Returns: Json }
      is_active_caller: { Args: never; Returns: boolean }
      is_admin_caller: { Args: never; Returns: boolean }
      is_non_working_day: {
        Args: { p_company_id: string; ts: string }
        Returns: boolean
      }
      is_super_admin_caller: { Args: never; Returns: boolean }
      local_midnight: { Args: { ts: string }; Returns: string }
      matter_detail: { Args: { p_matter_id: string }; Returns: Json }
      matters_admin_delete: { Args: { p_matter_id: string }; Returns: Json }
      matters_admin_update: {
        Args: { p_client_name: string; p_matter_id: string; p_title: string }
        Returns: Json
      }
      matters_complete_filing: { Args: { p_matter_id: string }; Returns: Json }
      matters_complete_step1: { Args: { p_matter_id: string }; Returns: Json }
      matters_complete_step2_and_submit: {
        Args: { p_matter_id: string; p_notes?: string }
        Returns: Json
      }
      matters_create: {
        Args: {
          p_client_name: string
          p_employee_id: string
          p_tat?: Json
          p_title: string
          p_type: Database["public"]["Enums"]["matter_type_t"]
        }
        Returns: Json
      }
      matters_decide_transfer: {
        Args: {
          p_decision: Database["public"]["Enums"]["request_status_t"]
          p_notes?: string
          p_transfer_request_id: string
        }
        Returns: Json
      }
      matters_founder_decision: {
        Args: {
          p_cycle_id: string
          p_decision: Database["public"]["Enums"]["cycle_decision_t"]
          p_matter_id: string
          p_notes?: string
        }
        Returns: Json
      }
      matters_record_client_decision: {
        Args: {
          p_cycle_id: string
          p_decision: Database["public"]["Enums"]["cycle_decision_t"]
          p_matter_id: string
          p_notes?: string
        }
        Returns: Json
      }
      matters_request_transfer: {
        Args: {
          p_matter_id: string
          p_reason: string
          p_to_employee_id: string
        }
        Returns: Json
      }
      matters_send_for_client_approval: {
        Args: { p_matter_id: string }
        Returns: Json
      }
      matters_send_for_filing: { Args: { p_matter_id: string }; Returns: Json }
      matters_submit_to_founder: {
        Args: { p_matter_id: string; p_notes?: string }
        Returns: Json
      }
      open_matter_step: {
        Args: {
          p_assigned_employee_id: string
          p_client_round_number: number
          p_company_id: string
          p_matter_id: string
          p_started_at?: string
          p_step_type: Database["public"]["Enums"]["step_type_t"]
        }
        Returns: {
          assigned_employee_id: string | null
          client_round_number: number
          company_id: string
          completed_at: string | null
          created_at: string
          due_at: string | null
          matter_id: string
          started_at: string
          status: Database["public"]["Enums"]["step_status_t"]
          step_instance_id: string
          step_type: Database["public"]["Enums"]["step_type_t"]
          tat_unit: Database["public"]["Enums"]["tat_unit_t"] | null
          tat_value: number | null
        }
        SetofOptions: {
          from: "*"
          to: "matter_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      open_workflow_instance_step: {
        Args: {
          p_actor_id: string
          p_company_id: string
          p_instance_id: string
          p_started_at?: string
          p_step_id: string
        }
        Returns: {
          assigned_client_id: string | null
          assigned_employee_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          due_at: string | null
          entry_number: number
          id: string
          instance_id: string
          started_at: string
          status: Database["public"]["Enums"]["step_status_t"]
          step_id: string
          tat_unit: Database["public"]["Enums"]["tat_unit_t"] | null
          tat_value: number | null
        }
        SetofOptions: {
          from: "*"
          to: "workflow_instance_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      require_any_matter: {
        Args: { p_company_id: string; p_matter_id: string }
        Returns: {
          client_approved_in_current_round: boolean
          client_name: string | null
          client_round_counter: number
          company_id: string
          created_at: string
          created_by: string | null
          current_step: Database["public"]["Enums"]["matter_step_t"]
          employee_id: string
          founder_approved_in_current_round: boolean
          founder_id: string
          founder_iteration_counter: number
          matter_id: string
          status: Database["public"]["Enums"]["matter_status_t"]
          title: string
          type: Database["public"]["Enums"]["matter_type_t"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "matters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      require_auth: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["auth_ctx"]
        SetofOptions: {
          from: "*"
          to: "auth_ctx"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      require_owned_matter: {
        Args: { p_company_id: string; p_matter_id: string; p_user_id: string }
        Returns: {
          client_approved_in_current_round: boolean
          client_name: string | null
          client_round_counter: number
          company_id: string
          created_at: string
          created_by: string | null
          current_step: Database["public"]["Enums"]["matter_step_t"]
          employee_id: string
          founder_approved_in_current_round: boolean
          founder_id: string
          founder_iteration_counter: number
          matter_id: string
          status: Database["public"]["Enums"]["matter_status_t"]
          title: string
          type: Database["public"]["Enums"]["matter_type_t"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "matters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_step_tat: {
        Args: {
          p_company_id: string
          p_matter_id: string
          p_start_at: string
          p_step_type: Database["public"]["Enums"]["step_type_t"]
        }
        Returns: Record<string, unknown>
      }
      run_overdue_scan: { Args: never; Returns: number }
      score_overdue_for_ref: {
        Args: {
          p_company_id: string
          p_description: string
          p_due_at: string
          p_employee_id: string
          p_event_type: Database["public"]["Enums"]["score_event_t"]
          p_ref_id: string
          p_ref_type: Database["public"]["Enums"]["score_ref_t"]
          p_reference_at: string
        }
        Returns: number
      }
      scoring_get_my_summary: { Args: never; Returns: Json }
      scoring_get_summary: {
        Args: { p_role?: Database["public"]["Enums"]["role_t"] }
        Returns: Json
      }
      scoring_recompute_overdue_now: { Args: never; Returns: Json }
      start_of_next_day: { Args: { ts: string }; Returns: string }
      super_admin_create_company: {
        Args: {
          p_color_primary?: string
          p_color_secondary?: string
          p_logo_url?: string
          p_max_users?: number
          p_name: string
          p_works_saturday?: boolean
          p_works_sunday?: boolean
        }
        Returns: Json
      }
      super_admin_list_companies: { Args: never; Returns: Json }
      super_admin_list_workflows: { Args: never; Returns: Json }
      super_admin_update_company: {
        Args: {
          p_color_primary?: string
          p_color_secondary?: string
          p_company_id: string
          p_court_appearances_enabled?: boolean
          p_logo_url?: string
          p_matters_enabled?: boolean
          p_max_users?: number
          p_name?: string
          p_status?: Database["public"]["Enums"]["company_status_t"]
          p_tasks_enabled?: boolean
          p_works_saturday?: boolean
          p_works_sunday?: boolean
        }
        Returns: Json
      }
      task_detail: { Args: { p_task_id: string }; Returns: Json }
      tasks_admin_delete: { Args: { p_task_id: string }; Returns: Json }
      tasks_admin_push_due_date: {
        Args: { p_new_due_at: string; p_notes?: string; p_task_id: string }
        Returns: Json
      }
      tasks_admin_update: {
        Args: {
          p_description: string
          p_priority: Database["public"]["Enums"]["task_priority_t"]
          p_task_id: string
          p_title: string
        }
        Returns: Json
      }
      tasks_create: {
        Args: {
          p_assigned_to: string
          p_description: string
          p_due_at: string
          p_priority: Database["public"]["Enums"]["task_priority_t"]
          p_title: string
        }
        Returns: Json
      }
      tasks_decide_push_request: {
        Args: {
          p_decision: Database["public"]["Enums"]["request_status_t"]
          p_notes?: string
          p_push_request_id: string
        }
        Returns: Json
      }
      tasks_request_push_due_date: {
        Args: {
          p_reason: string
          p_requested_due_at: string
          p_task_id: string
        }
        Returns: Json
      }
      tasks_update_status: {
        Args: {
          p_status: Database["public"]["Enums"]["task_status_t"]
          p_task_id: string
        }
        Returns: Json
      }
      validate_workflow_field_value: {
        Args: {
          p_company_id: string
          p_field: Database["public"]["Tables"]["workflow_field_definitions"]["Row"]
          p_value: Json
        }
        Returns: undefined
      }
      workflow_definition_create: {
        Args: {
          p_created_by_role: Database["public"]["Enums"]["step_actor_role_t"]
          p_description?: string
          p_entity_id_prefix: string
          p_entity_label: string
          p_key: string
          p_name: string
        }
        Returns: Json
      }
      workflow_definition_get: {
        Args: { p_workflow_id: string }
        Returns: Json
      }
      workflow_definition_update: {
        Args: {
          p_description?: string
          p_name?: string
          p_status?: Database["public"]["Enums"]["workflow_definition_status_t"]
          p_workflow_id: string
        }
        Returns: Json
      }
      workflow_field_create: {
        Args: {
          p_field_type: Database["public"]["Enums"]["workflow_field_type_t"]
          p_is_required?: boolean
          p_key: string
          p_label: string
          p_options?: Json
          p_order_index?: number
          p_penalize_client_on_no?: boolean
          p_references_workflow_id?: string
          p_step_id?: string
          p_workflow_id: string
        }
        Returns: Json
      }
      workflow_field_delete: { Args: { p_field_id: string }; Returns: Json }
      workflow_field_update: {
        Args: {
          p_field_id: string
          p_is_required?: boolean
          p_label?: string
          p_options?: Json
          p_order_index?: number
          p_penalize_client_on_no?: boolean
        }
        Returns: Json
      }
      workflow_instance_complete_action: {
        Args: {
          p_field_values?: Json
          p_instance_id: string
          p_step_id: string
        }
        Returns: Json
      }
      workflow_instance_create: {
        Args: {
          p_assigned_to: string
          p_client_id?: string
          p_field_values?: Json
          p_tat?: Json
          p_title: string
          p_workflow_id: string
        }
        Returns: Json
      }
      workflow_instance_decide: {
        Args: {
          p_decision: Database["public"]["Enums"]["cycle_decision_t"]
          p_field_values?: Json
          p_instance_id: string
          p_instance_step_id: string
          p_notes?: string
          p_step_id: string
        }
        Returns: Json
      }
      workflow_instance_decide_transfer: {
        Args: {
          p_decision: Database["public"]["Enums"]["request_status_t"]
          p_notes?: string
          p_transfer_request_id: string
        }
        Returns: Json
      }
      workflow_instance_get: { Args: { p_instance_id: string }; Returns: Json }
      workflow_instance_request_transfer: {
        Args: {
          p_instance_id: string
          p_reason: string
          p_to_employee_id: string
        }
        Returns: Json
      }
      workflow_step_create: {
        Args: {
          p_actor_role: Database["public"]["Enums"]["step_actor_role_t"]
          p_is_entry_step?: boolean
          p_key: string
          p_name: string
          p_order_index?: number
          p_step_kind: Database["public"]["Enums"]["step_kind_t"]
          p_workflow_id: string
        }
        Returns: Json
      }
      workflow_step_delete: { Args: { p_step_id: string }; Returns: Json }
      workflow_step_update: {
        Args: {
          p_actor_role?: Database["public"]["Enums"]["step_actor_role_t"]
          p_clear_default_tat?: boolean
          p_clear_next_step?: boolean
          p_clear_reject_next_step?: boolean
          p_default_tat_unit?: Database["public"]["Enums"]["tat_unit_t"]
          p_default_tat_value?: number
          p_name?: string
          p_next_step_id?: string
          p_order_index?: number
          p_reject_next_step_id?: string
          p_requires_notes_on_reject?: boolean
          p_scores_on_overdue?: boolean
          p_scores_on_reentry?: boolean
          p_step_id: string
        }
        Returns: Json
      }
      working_days_late: {
        Args: { due_at: string; p_company_id: string; reference_at: string }
        Returns: number
      }
    }
    Enums: {
      company_status_t: "ACTIVE" | "SUSPENDED"
      cycle_decision_t: "PENDING" | "APPROVED" | "CHANGES_REQUESTED"
      cycle_type_t: "FOUNDER_REVIEW" | "CLIENT_REVIEW"
      initiated_by_t: "ADMIN" | "EMPLOYEE"
      matter_status_t: "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
      matter_step_t:
        | "DRAFTING_STEP1"
        | "DRAFTING_STEP2"
        | "AWAITING_FOUNDER_REVIEW"
        | "REVISING_AFTER_FOUNDER_NOTES"
        | "READY_FOR_CLIENT_SEND"
        | "AWAITING_CLIENT_REVIEW"
        | "REVISING_AFTER_CLIENT_CHANGES"
        | "READY_FOR_FILING"
        | "AWAITING_FILING_COMPLETION"
        | "COMPLETED"
      matter_type_t: "LITIGATION" | "NON_LITIGATION"
      push_status_t: "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPROVED"
      request_status_t: "PENDING" | "APPROVED" | "REJECTED"
      role_t: "FOUNDER_ADMIN" | "EMPLOYEE" | "SUPER_ADMIN" | "CLIENT"
      score_event_t:
        | "FOUNDER_RESUBMISSION"
        | "OVERDUE_STEP"
        | "OVERDUE_TASK"
        | "ADMIN_ADJUSTMENT"
        | "CLIENT_DATA_NOT_PROVIDED"
      score_ref_t:
        | "MATTER_APPROVAL"
        | "MATTER_STEP"
        | "TASK"
        | "WORKFLOW_INSTANCE_STEP"
        | "WORKFLOW_INSTANCE_DECISION"
      step_actor_role_t: "ASSIGNEE" | "COMPANY_ADMIN" | "CLIENT"
      step_kind_t: "ACTION" | "DECISION"
      step_status_t:
        | "IN_PROGRESS"
        | "PENDING"
        | "BREACHED_OPEN"
        | "DONE"
        | "BREACHED_DONE"
      step_type_t:
        | "STEP1_DATES_NOTES"
        | "STEP2_BRIEF"
        | "CLIENT_APPROVAL_SEND"
        | "FILING"
      task_priority_t: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
      task_status_t: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED"
      tat_mode_t: "DEFAULT" | "PER_INSTANCE"
      tat_unit_t: "DAYS" | "HOURS"
      user_status_t: "ACTIVE" | "DISABLED"
      workflow_definition_status_t: "ACTIVE" | "ARCHIVED"
      workflow_field_type_t:
        | "TEXT"
        | "NUMBER"
        | "DATE"
        | "SINGLE_SELECT"
        | "MULTI_SELECT"
        | "EMPLOYEE_PICKER"
        | "YES_NO"
        | "INSTANCE_REFERENCE"
    }
    CompositeTypes: {
      auth_ctx: {
        user_id: string | null
        role: string | null
        company_id: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      company_status_t: ["ACTIVE", "SUSPENDED"],
      cycle_decision_t: ["PENDING", "APPROVED", "CHANGES_REQUESTED"],
      cycle_type_t: ["FOUNDER_REVIEW", "CLIENT_REVIEW"],
      initiated_by_t: ["ADMIN", "EMPLOYEE"],
      matter_status_t: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
      matter_step_t: [
        "DRAFTING_STEP1",
        "DRAFTING_STEP2",
        "AWAITING_FOUNDER_REVIEW",
        "REVISING_AFTER_FOUNDER_NOTES",
        "READY_FOR_CLIENT_SEND",
        "AWAITING_CLIENT_REVIEW",
        "REVISING_AFTER_CLIENT_CHANGES",
        "READY_FOR_FILING",
        "AWAITING_FILING_COMPLETION",
        "COMPLETED",
      ],
      matter_type_t: ["LITIGATION", "NON_LITIGATION"],
      push_status_t: ["PENDING", "APPROVED", "REJECTED", "AUTO_APPROVED"],
      request_status_t: ["PENDING", "APPROVED", "REJECTED"],
      role_t: ["FOUNDER_ADMIN", "EMPLOYEE", "SUPER_ADMIN", "CLIENT"],
      score_event_t: [
        "FOUNDER_RESUBMISSION",
        "OVERDUE_STEP",
        "OVERDUE_TASK",
        "ADMIN_ADJUSTMENT",
        "CLIENT_DATA_NOT_PROVIDED",
      ],
      score_ref_t: [
        "MATTER_APPROVAL",
        "MATTER_STEP",
        "TASK",
        "WORKFLOW_INSTANCE_STEP",
        "WORKFLOW_INSTANCE_DECISION",
      ],
      step_actor_role_t: ["ASSIGNEE", "COMPANY_ADMIN", "CLIENT"],
      step_kind_t: ["ACTION", "DECISION"],
      step_status_t: [
        "IN_PROGRESS",
        "PENDING",
        "BREACHED_OPEN",
        "DONE",
        "BREACHED_DONE",
      ],
      step_type_t: [
        "STEP1_DATES_NOTES",
        "STEP2_BRIEF",
        "CLIENT_APPROVAL_SEND",
        "FILING",
      ],
      task_priority_t: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      task_status_t: ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"],
      tat_mode_t: ["DEFAULT", "PER_INSTANCE"],
      tat_unit_t: ["DAYS", "HOURS"],
      user_status_t: ["ACTIVE", "DISABLED"],
      workflow_definition_status_t: ["ACTIVE", "ARCHIVED"],
      workflow_field_type_t: [
        "TEXT",
        "NUMBER",
        "DATE",
        "SINGLE_SELECT",
        "MULTI_SELECT",
        "EMPLOYEE_PICKER",
        "YES_NO",
        "INSTANCE_REFERENCE",
      ],
    },
  },
} as const
