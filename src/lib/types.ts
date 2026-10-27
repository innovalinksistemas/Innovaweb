export type ClientStatus = 'activo' | 'pausado' | 'inactivo';
export type Platform = 'astro' | 'wordpress' | 'otro';
export type SiteStatus = 'activo' | 'desarrollo' | 'mantenimiento' | 'pausado' | 'archivado';

export interface Client {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  status: ClientStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  client_id: string;
  name: string;
  url: string;
  platform: Platform;
  status: SiteStatus;
  hosting_provider: string | null;
  hosting_panel_url: string | null;
  hosting_renewal_date: string | null;
  domain_registrar: string | null;
  domain_expiry_date: string | null;
  admin_url: string | null;
  repo_url: string | null;
  deploy_url: string | null;
  credentials_url: string | null;
  ga4_property_id: string | null;
  ga4_last_sync_at: string | null;
  ga4_last_error: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}


export const CLIENT_FIELDS = ['name', 'contact_name', 'email', 'phone', 'tax_id', 'status', 'notes'] as const;
export type ClientField = (typeof CLIENT_FIELDS)[number];

export const SITE_FIELDS = [
  'client_id', 'name', 'url', 'platform', 'status',
  'hosting_provider', 'hosting_panel_url', 'hosting_renewal_date',
  'domain_registrar', 'domain_expiry_date',
  'admin_url', 'repo_url', 'deploy_url', 'credentials_url',
  'ga4_property_id', 'notes',
] as const;
export type SiteField = (typeof SITE_FIELDS)[number];

export const CLIENT_STATUSES: ClientStatus[] = ['activo', 'pausado', 'inactivo'];
export const PLATFORMS: Platform[] = ['astro', 'wordpress', 'otro'];
export const SITE_STATUSES: SiteStatus[] = ['activo', 'desarrollo', 'mantenimiento', 'pausado', 'archivado'];

// ---------------------------------------------------------------
// Etapa 2: proyectos, tareas y seguimientos
// ---------------------------------------------------------------
export type ProjectStatus = 'planificacion' | 'en_curso' | 'en_pausa' | 'completado' | 'cancelado';
export type TaskStatus = 'pendiente' | 'en_progreso' | 'en_revision' | 'completada';
export type TaskPriority = 'baja' | 'media' | 'alta' | 'urgente';
export type FollowUpKind = 'nota' | 'reunion' | 'decision' | 'importante' | 'proximo_paso';

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  active: boolean;
}

export interface Project {
  id: string;
  client_id: string;
  site_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  due_date: string | null;
  budget: number | null;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  completed_at: string | null;
  created_at: string;
}

/** Tarea con su proyecto y cliente (para listas globales). */
export type TaskRow = Task & { projects?: { id: string; name: string; clients: { name: string } | null } | null };

export interface FollowUp {
  id: string;
  project_id: string;
  kind: FollowUpKind;
  content: string;
  pinned: boolean;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  author_id: string | null;
  author_name: string | null;
  author_email: string | null;
  created_at: string;
}

export const PROJECT_FIELDS = ['client_id', 'site_id', 'name', 'description', 'status', 'start_date', 'due_date', 'budget', 'hourly_rate'] as const;
export type ProjectField = (typeof PROJECT_FIELDS)[number];

export const TASK_FIELDS = ['title', 'description', 'status', 'priority', 'assignee_id', 'due_date'] as const;
export type TaskField = (typeof TASK_FIELDS)[number];

export const PROJECT_STATUSES: ProjectStatus[] = ['planificacion', 'en_curso', 'en_pausa', 'completado', 'cancelado'];
export const TASK_STATUSES: TaskStatus[] = ['pendiente', 'en_progreso', 'en_revision', 'completada'];
export const TASK_PRIORITIES: TaskPriority[] = ['baja', 'media', 'alta', 'urgente'];
export const FOLLOW_UP_KINDS: FollowUpKind[] = ['nota', 'reunion', 'decision', 'importante', 'proximo_paso'];

// ---------------------------------------------------------------
// Etapa 3: costeo
// ---------------------------------------------------------------
export type ExpenseCategory = 'hosting' | 'dominio' | 'plugin' | 'licencia' | 'suscripcion' | 'servicio' | 'otro';
export type ExpenseFrequency = 'unica' | 'mensual' | 'anual';
export type InvoiceStatus = 'borrador' | 'emitida' | 'anulada';
export type PaymentStatus = 'borrador' | 'anulada' | 'pendiente' | 'parcial' | 'pagada' | 'vencida';

export interface TimeEntry {
  id: string;
  project_id: string;
  task_id: string | null;
  member_id: string | null;
  entry_date: string;
  hours: number | null;
  description: string | null;
  billable: boolean;
  cost_rate: number | null;
  started_at: string | null;
  ended_at: string | null;
}

export type TimeEntryRow = TimeEntry & {
  projects: { id: string; name: string } | null;
  tasks: { id: string; title: string } | null;
};

export interface Expense {
  id: string;
  client_id: string | null;
  site_id: string | null;
  project_id: string | null;
  concept: string;
  category: ExpenseCategory;
  provider: string | null;
  amount: number;
  frequency: ExpenseFrequency;
  start_date: string;
  end_date: string | null;
  rebillable: boolean;
  notes: string | null;
}

/** Fila de la vista expenses_overview. */
export type ExpenseRow = Expense & {
  monthly_equivalent: number | null;
  next_due: string | null;
  occurrences: number;
  total_to_date: number;
};

export interface Invoice {
  id: string;
  client_id: string;
  project_id: string | null;
  number: string | null;
  concept: string | null;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  total: number;
  status: InvoiceStatus;
  notes: string | null;
}

/** Fila de la vista invoices_overview. */
export type InvoiceRow = Invoice & {
  paid: number;
  balance: number;
  last_paid_date: string | null;
  payment_status: PaymentStatus;
};

export interface Payment {
  id: string;
  invoice_id: string;
  paid_date: string;
  amount: number;
  method: string | null;
  notes: string | null;
}

export interface ProjectFinancials {
  project_id: string;
  client_id: string;
  name: string;
  status: ProjectStatus;
  budget: number | null;
  hourly_rate: number | null;
  hours: number;
  billable_hours: number;
  labor_cost: number;
  missing_cost_hours: number | null;
  expenses_cost: number;
  total_cost: number;
  billable_value: number;
  invoiced: number;
  invoiced_net: number;
  collected: number;
  receivable: number;
}

export const TIME_ENTRY_FIELDS = ['project_id', 'task_id', 'member_id', 'entry_date', 'hours', 'description'] as const;
export type TimeEntryField = (typeof TIME_ENTRY_FIELDS)[number];

export const EXPENSE_FIELDS = ['concept', 'category', 'provider', 'amount', 'frequency', 'start_date', 'end_date', 'client_id', 'site_id', 'project_id', 'notes'] as const;
export type ExpenseField = (typeof EXPENSE_FIELDS)[number];

export const INVOICE_FIELDS = ['client_id', 'project_id', 'number', 'concept', 'issue_date', 'due_date', 'subtotal', 'tax_rate', 'status', 'notes'] as const;
export type InvoiceField = (typeof INVOICE_FIELDS)[number];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['hosting', 'dominio', 'plugin', 'licencia', 'suscripcion', 'servicio', 'otro'];
export const EXPENSE_FREQUENCIES: ExpenseFrequency[] = ['unica', 'mensual', 'anual'];
export const INVOICE_STATUSES: InvoiceStatus[] = ['borrador', 'emitida', 'anulada'];
