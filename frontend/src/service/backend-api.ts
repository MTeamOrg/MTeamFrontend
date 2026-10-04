import type { UserRole, UserStatus } from '../features/authentication/auth-types'
import { apiRequest } from './api-client'
import { addDays } from './date-time'

export interface Page<T> {
  items: T[]
  page: number
  limit: number
  total: number
}

export type MembershipStatus = 'CURRENT' | 'EXPIRING_SOON' | 'EXPIRED'
export type PaymentStatus = 'ACCREDITED' | 'VOIDED'
export type MedicalCertificateStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED'
export type EventDisplayStatus = 'UPCOMING' | 'FINISHED' | 'CANCELLED'
export type PublicationAudience = 'ALL' | 'MEMBERS' | 'TRAINERS'
export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'INACTIVE'
export type NotificationType =
  | 'MEMBERSHIP_PRICE_CHANGED'
  | 'MEMBERSHIP_EXPIRING'
  | 'MEMBERSHIP_EXPIRED'
  | 'MEDICAL_CERTIFICATE_REVIEWED'
  | 'CLASS_CHANGED'
  | 'EVENT_CANCELLED'
  | 'GENERAL'

export interface Event {
  id: string
  title: string
  description: string
  startsAt: string
  location: string
  imageUrl: string
  status: EventStatus
  displayStatus: EventDisplayStatus
  createdById: string
}

export interface NewsPost {
  id: string
  title: string
  content: string
  imageUrl: string | null
  audience: PublicationAudience
  status: PublicationStatus
  publishedAt: string | null
  createdById: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: NotificationType
  createdAt: string
  readAt: string | null
}

export interface MedicalCertificateMember {
  id: string
  firstName: string
  lastName: string
  documentNumber: string
  email: string
}

export interface MedicalCertificateReviewer {
  id: string
  firstName: string
  lastName: string
}

export interface MedicalCertificate {
  id: string
  memberId: string
  status: MedicalCertificateStatus
  uploadedAt: string
  reviewedAt: string | null
  reviewComment: string | null
  member: MedicalCertificateMember
  reviewedBy: MedicalCertificateReviewer | null
}

export interface InitialMedicalCertificatePeriod {
  startsAt: string | null
  expiresAt: string | null
  daysRemaining: number
  isActive: boolean
}

export interface OwnMedicalCertificateResponse extends Page<MedicalCertificate> {
  initialMedicalCertificatePeriod: InitialMedicalCertificatePeriod
}

export interface OwnMedicalCertificateView {
  current: MedicalCertificate | null
  history: MedicalCertificate[]
  initialPeriod: InitialMedicalCertificatePeriod
  page: number
  limit: number
  total: number
}

export interface MedicalCertificateFileResponse {
  signedUrl: string
  expiresIn: number
}

export type AdminMedicalCertificate = MedicalCertificate
export type AdminMedicalCertificatePage = Page<AdminMedicalCertificate>

export interface OwnProfile {
  id: string
  firstName: string
  lastName: string
  documentNumber: string
  birthDate: string
  email: string
  phone: string
  photoUrl: string | null
  role: UserRole
  status: UserStatus
  isPasswordChangeRequired: boolean
  memberProfile: { emergencyContactName: string; emergencyContactPhone: string } | null
  trainerProfile: { specialty: string; description: string } | null
}

export interface AdminDashboardMetrics {
  activeMembers: number
  inactiveMembers: number
  currentMemberships: number
  expiringMemberships: number
  expiredMemberships: number
  pendingMedicalCertificates: number
  rejectedMedicalCertificates: number
  initialPeriodMembers: number
}

export interface AccessAttempt {
  id: string
  userId: string
  roleAtAttempt: UserRole
  branchId: string | null
  accessPointId: string | null
  result: 'ALLOWED' | 'DENIED'
  denialReason: string | null
  attemptedAt: string
  user?: PersonRef
  branch?: EntityRef | null
  accessPoint?: EntityRef | null
}

export interface UserListItem {
  id: string
  firstName: string
  lastName: string
  documentNumber: string
  email: string
  role: UserRole
  status: UserStatus
}

export interface AdminUserDetail extends OwnProfile {
  createdAt: string
  membership: { status: 'ACTIVE' | 'EXPIRED'; paymentId: string; expiresAt: string } | null
  payments: Array<Payment & { createdAt: string }>
  medicalCertificates: Array<{
    id: string
    fileUrl: string
    status: string
    uploadedAt: string
    reviewedAt: string | null
    reviewComment: string | null
  }>
  trainerBranches: Array<{ id: string; name: string; address: string }>
  classes: Array<{ id: string; activity: string; startsAt: string; branch: EntityRef }>
}

export interface CreateUserInput {
  firstName: string
  lastName: string
  documentNumber: string
  birthDate: string
  email: string
  phone: string
  password: string
  role: UserRole
  emergencyContactName?: string
  emergencyContactPhone?: string
  specialty?: string
  description?: string
}

export interface UserAuditLog {
  id: string
  userId: string
  action: 'CREATED' | 'UPDATED' | 'ACTIVATED' | 'DEACTIVATED' | 'PASSWORD_RESET'
  reason: string | null
  occurredAt: string
  performedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: UserRole
  }
}

export interface MemberListItem extends Omit<UserListItem, 'role'> {
  membershipStatus: MembershipStatus
  lastPaymentAt: string | null
  expiresAt: string | null
}

export interface OwnMembership {
  currentPrice: string | null
  lastPaymentAt: string | null
  expiresAt: string | null
  daysRemaining: number
  status: MembershipStatus
}

export interface MembershipPrice {
  id: string
  amount: string
  effectiveFrom: string
  createdAt: string
  createdById: string
  previousAmount?: string | null
}

export interface Payment {
  id: string
  amount: string
  method: string
  receiptNumber: string | null
  status: PaymentStatus
  accreditedAt: string
  expiresAt: string
  voidedAt: string | null
  voidReason: string | null
}

export interface PaymentReportItem extends Payment {
  member: { id: string; firstName: string; lastName: string; documentNumber: string; email: string }
}

export interface PaymentSummaryDay {
  date: string
  amount: string
}

export interface PaymentSummary {
  from: string
  to: string
  paymentCount: number
  totalAmount: string
  days: PaymentSummaryDay[]
}

export interface PaymentPreview {
  member: { id: string; firstName: string; lastName: string; documentNumber: string; email: string }
  currentPrice: string
  amount: string
  method: string
  receiptNumber: string | null
  estimatedAccreditedAt: string
  estimatedExpiresAt: string
}

export interface Branch {
  id: string
  name: string
  imageUrl: string
  address: string
  openingHours: string
  phone: string
  description: string
  isActive?: boolean
  latitude?: string | null
  longitude?: string | null
  scheduledClasses?: Array<{
    id: string
    activity: string
    startsAt: string
    trainer: PersonRef | null
  }>
}

export interface BranchInput {
  name: string
  imageUrl: string
  address: string
  openingHours: string
  phone: string
  description: string
  latitude?: number | null
  longitude?: number | null
}

export interface PersonRef { id: string; firstName: string; lastName: string }
export interface EntityRef { id: string; name: string }
export interface Trainer extends PersonRef {
  photoUrl: string | null
  specialty: string
  description: string
  branches?: Array<{ id: string; name: string; address: string }>
}

export interface ScheduleClass {
  id: string
  activity: string
  day: string
  startsAt: string
  startTime: string
  branch: EntityRef
  trainer: PersonRef | null
}

export interface WeeklySchedule {
  id: string | null
  weekStartsOn: string
  classes: ScheduleClass[]
}

export interface ScheduledClassInput {
  weekStartsOn: string
  activity: string
  startsAt: string
  branchId: string
  trainerId: string | null
}

export type ScheduledClassUpdate = Partial<Omit<ScheduledClassInput, 'weekStartsOn'>>

export interface ScheduledClassRecord {
  id: string
  scheduleId: string
  weekStartsOn: string
  activity: string
  startsAt: string
  branchId: string
  trainerId: string | null
}

function queryString(values: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const value = query.toString()
  return value ? `?${value}` : ''
}

function dateTimeFilter(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = endOfDay ? addDays(value, 1) : value
  return `${date}T00:00:00-03:00`
}

export const backendApi = {
  getCurrentIdentity: () => apiRequest<OwnProfile>('/auth/me'),
  getOwnProfile: () => apiRequest<OwnProfile>('/users/me'),
  updateOwnProfile: (
    body: Partial<Pick<OwnProfile, 'email' | 'phone'>> & {
      emergencyContactName?: string
      emergencyContactPhone?: string
    },
  ) => apiRequest<OwnProfile>('/users/me', { method: 'PATCH', body }),
  updateOwnPhoto: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return apiRequest<OwnProfile>('/users/me/photo', { method: 'PUT', body })
  },

  listUsers: (filters: {
    search?: string
    role?: UserRole
    status?: UserStatus
    membershipStatus?: MembershipStatus
    initialPeriod?: boolean
    page?: number
    limit?: number
  }) => apiRequest<Page<UserListItem>>(`/users${queryString(filters)}`),
  getUser: (id: string) => apiRequest<AdminUserDetail>(`/users/${id}`),
  createUser: (body: CreateUserInput) =>
    apiRequest<AdminUserDetail>('/users', { method: 'POST', body }),
  updateUser: (id: string, body: Record<string, unknown>) =>
    apiRequest<AdminUserDetail>(`/users/${id}`, { method: 'PATCH', body }),
  updateUserStatus: (id: string, status: UserStatus, reason?: string) =>
    apiRequest<UserListItem>(`/users/${id}/status`, {
      method: 'PATCH',
      body: { status, ...(reason ? { reason } : {}) },
    }),
  resetUserPassword: (id: string, temporaryPassword: string) =>
    apiRequest<void>(`/users/${id}/password-resets`, {
      method: 'POST',
      body: { temporaryPassword },
    }),
  listUserAuditLogs: (id: string, page = 1, limit = 20) =>
    apiRequest<Page<UserAuditLog>>(`/users/${id}/audit-logs${queryString({ page, limit })}`),
  updateTrainerBranches: (id: string, branchIds: string[]) =>
    apiRequest<AdminUserDetail>(`/users/${id}/trainer-branches`, {
      method: 'PUT',
      body: { branchIds },
    }),
  getAdminDashboardMetrics: () =>
    apiRequest<AdminDashboardMetrics>('/admin/dashboard/metrics'),
  listAccessAttempts: (filters: { page?: number; limit?: number; from?: string; to?: string; result?: 'ALLOWED' | 'DENIED' } = {}) =>
    apiRequest<Page<AccessAttempt>>(`/access-attempts${queryString(filters)}`),

  listEvents: (filters: { search?: string; status?: EventStatus; page?: number; limit?: number } = {}) =>
    apiRequest<Page<Event>>(`/events${queryString(filters)}`),
  getEvent: (id: string) => apiRequest<Event>(`/events/${id}`),
  createEvent: (body: {
    title: string
    description: string
    startsAt: string
    location: string
    imageUrl: string
    status?: 'DRAFT' | 'PUBLISHED'
  }) => apiRequest<Event>('/events', { method: 'POST', body }),
  updateEvent: (id: string, body: Partial<Pick<Event, 'title' | 'description' | 'startsAt' | 'location' | 'imageUrl'>>) =>
    apiRequest<Event>(`/events/${id}`, { method: 'PATCH', body }),
  updateEventStatus: (id: string, status: 'PUBLISHED' | 'CANCELLED') =>
    apiRequest<Event>(`/events/${id}/status`, { method: 'PATCH', body: { status } }),
  listNewsPosts: (filters: {
    search?: string
    audience?: PublicationAudience
    status?: PublicationStatus
    page?: number
    limit?: number
  } = {}) => apiRequest<Page<NewsPost>>(`/news-posts${queryString(filters)}`),
  getNewsPost: (id: string) => apiRequest<NewsPost>(`/news-posts/${id}`),
  createNewsPost: (body: {
    title: string
    content: string
    imageUrl?: string | null
    audience: PublicationAudience
    status?: 'DRAFT' | 'PUBLISHED'
  }) => apiRequest<NewsPost>('/news-posts', { method: 'POST', body }),
  updateNewsPost: (id: string, body: Partial<Pick<NewsPost, 'title' | 'content' | 'imageUrl' | 'audience'>>) =>
    apiRequest<NewsPost>(`/news-posts/${id}`, { method: 'PATCH', body }),
  updateNewsPostStatus: (id: string, status: 'PUBLISHED' | 'INACTIVE') =>
    apiRequest<NewsPost>(`/news-posts/${id}/status`, { method: 'PATCH', body: { status } }),
  listNotifications: (filters: { page?: number; limit?: number; isRead?: boolean } = {}) =>
    apiRequest<Page<Notification>>(`/notifications${queryString(filters)}`),
  getNotification: (id: string) => apiRequest<Notification>(`/notifications/${id}`),
  markNotificationAsRead: (id: string) =>
    apiRequest<void>(`/notifications/${id}/read-status`, { method: 'PATCH' }),
  markAllNotificationsAsRead: () =>
    apiRequest<void>('/notifications/read-status', { method: 'PATCH' }),

  listMembers: (filters: {
    search?: string
    membershipStatus?: MembershipStatus
    page?: number
    limit?: number
  }) => apiRequest<Page<MemberListItem>>(`/members${queryString(filters)}`),
  getOwnMembership: () => apiRequest<OwnMembership>('/members/me/membership'),

  getCurrentPrice: () => apiRequest<MembershipPrice>('/membership-prices/current'),
  listPrices: (page = 1, limit = 20) =>
    apiRequest<Page<MembershipPrice>>(`/membership-prices${queryString({ page, limit })}`),
  createPrice: (amount: number, effectiveFrom: string) =>
    apiRequest<MembershipPrice>('/membership-prices', {
      method: 'POST',
      body: { amount, effectiveFrom },
    }),

  listOwnPayments: (page = 1, limit = 20) =>
    apiRequest<Page<Payment>>(`/members/me/payments${queryString({ page, limit })}`),
  getOwnMedicalCertificates: (page = 1, limit = 20) =>
    apiRequest<OwnMedicalCertificateResponse>(
      `/members/me/medical-certificates${queryString({ page, limit })}`,
    ).then(({ items, page: responsePage, limit: responseLimit, total, initialMedicalCertificatePeriod }) => {
      const [current = null, ...history] = items
      return {
        current,
        history,
        initialPeriod: initialMedicalCertificatePeriod,
        page: responsePage,
        limit: responseLimit,
        total,
      } satisfies OwnMedicalCertificateView
    }),
  uploadOwnMedicalCertificate: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return apiRequest<MedicalCertificate>('/members/me/medical-certificates', { method: 'POST', body })
  },
  listAdminMedicalCertificates: (filters: {
    search?: string
    status?: MedicalCertificateStatus
    from?: string
    to?: string
    page?: number
    limit?: number
  }) => apiRequest<AdminMedicalCertificatePage>(
    `/medical-certificates${queryString({
      ...filters,
      from: filters.from ? dateTimeFilter(filters.from) : undefined,
      to: filters.to ? dateTimeFilter(filters.to, true) : undefined,
    })}`,
  ),
  getAdminMedicalCertificate: (id: string) =>
    apiRequest<AdminMedicalCertificate>(`/medical-certificates/${id}`),
  getMedicalCertificateFile: (id: string) =>
    apiRequest<MedicalCertificateFileResponse>(`/medical-certificates/${id}/file`),
  reviewMedicalCertificate: (
    id: string,
    status: Exclude<MedicalCertificateStatus, 'PENDING'>,
    reviewComment?: string,
  ) => apiRequest<AdminMedicalCertificate>(`/medical-certificates/${id}/review`, {
    method: 'PATCH',
    body: {
      status,
      ...(reviewComment ? { reviewComment } : {}),
    },
  }),
  listPayments: (filters: {
    page?: number
    limit?: number
    memberId?: string
    documentNumber?: string
    method?: string
    status?: PaymentStatus
    from?: string
    to?: string
  }) => apiRequest<Page<PaymentReportItem>>(`/payments${queryString(filters)}`),
  getPaymentsSummary: (from: string, to: string) =>
    apiRequest<PaymentSummary>(
      `/payments/summary${queryString({ from, to })}`,
    ),
  previewPayment: (body: {
    memberId: string
    amount: number
    method: string
    receiptNumber?: string
  }) => apiRequest<PaymentPreview>('/payments/previews', { method: 'POST', body }),
  createPayment: (body: {
    memberId: string
    amount: number
    method: string
    receiptNumber?: string
  }) => apiRequest<Payment>('/payments', { method: 'POST', body }),
  voidPayment: (id: string, reason: string) =>
    apiRequest<Payment>(`/payments/${id}/voids`, { method: 'POST', body: { reason } }),

  listBranches: (search = '', page = 1, limit = 100) =>
    apiRequest<Page<Branch>>(
      `/branches${queryString({ search: search || undefined, page, limit })}`,
      { authenticated: false },
    ),
  getBranch: (id: string) =>
    apiRequest<Branch>(`/branches/${id}`, { authenticated: false }),
  listAdminBranches: (filters: {
    search?: string
    isActive?: boolean
    page?: number
    limit?: number
  }) => apiRequest<Page<Branch>>(`/admin/branches${queryString(filters)}`),
  getAdminBranch: (id: string) => apiRequest<Branch>(`/admin/branches/${id}`),
  createBranch: (body: BranchInput) =>
    apiRequest<Branch>('/branches', { method: 'POST', body }),
  updateBranch: (id: string, body: Partial<BranchInput>) =>
    apiRequest<Branch>(`/branches/${id}`, { method: 'PATCH', body }),
  updateBranchStatus: (id: string, isActive: boolean) =>
    apiRequest<Branch>(`/branches/${id}/status`, { method: 'PATCH', body: { isActive } }),

  listTrainers: (page = 1, limit = 100) =>
    apiRequest<Page<Trainer>>(`/trainers${queryString({ page, limit })}`, {
      authenticated: false,
    }),
  getTrainerSchedule: (weekStartsOn?: string) =>
    apiRequest<WeeklySchedule>(`/trainer/classes${queryString({ weekStartsOn })}`),

  getWeeklySchedule: (weekStartsOn?: string) =>
    apiRequest<WeeklySchedule>(`/weekly-schedules${queryString({ weekStartsOn })}`, {
      authenticated: false,
    }),
  copyWeeklySchedule: (scheduleId: string, weekStartsOn: string) =>
    apiRequest<WeeklySchedule>(`/weekly-schedules/${scheduleId}/copies`, {
      method: 'POST',
      body: { weekStartsOn },
    }),
  createScheduledClass: (body: ScheduledClassInput) =>
    apiRequest<ScheduledClassRecord>('/scheduled-classes', { method: 'POST', body }),
  updateScheduledClass: (id: string, body: ScheduledClassUpdate) =>
    apiRequest<ScheduledClassRecord>(`/scheduled-classes/${id}`, { method: 'PATCH', body }),
  deleteScheduledClass: (id: string) =>
    apiRequest<void>(`/scheduled-classes/${id}`, { method: 'DELETE' }),
}
