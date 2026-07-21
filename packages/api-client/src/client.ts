import type {
  AcceptRequestBody,
  BlockedDateDto,
  CalendarDay,
  CreateBlockedDateRequest,
  CreateBlockedRangeRequest,
  CreateReservationRequest,
  CreateReservationResponse,
  CreateTableRequest,
  CreateTimeSlotRequest,
  DayHours,
  GuestDetail,
  GuestDto,
  ListGuestsQuery,
  LoginRequest,
  LoginResponse,
  PublicRestaurant,
  ReportsSummary,
  RequestQueueItem,
  ReservationDto,
  ReservationRulesDto,
  RestaurantDto,
  SetHoursRequest,
  SlotAvailability,
  TableAvailability,
  TableDto,
  TimeSlotDto,
  UpdateGuestRequest,
  UpdateReservationRulesRequest,
  UpdateReservationRulesResponse,
  UpdateRestaurantRequest,
  UpdateTableRequest,
  UpdateTimeSlotRequest,
} from "@rms/contracts";

import { ApiClientError } from "./error";

export interface ApiClientOptions {
  baseUrl: string;
  /** Attached as `Authorization: Bearer <token>` — omit for the public
   *  guest-facing calls, which need none. */
  getToken?: () => string | null | undefined;
}

/**
 * A hand-written, typed fetch wrapper rather than a generated OpenAPI
 * client. The API already documents itself at /docs from the same Zod
 * schemas these calls import — generating a second client from that spec
 * would be one more moving part to keep in sync for a surface this size.
 * Every method here is typed against @rms/contracts directly, the same
 * source of truth the server validates requests against.
 */
export function createApiClient({ baseUrl, getToken }: ApiClientOptions) {
  async function request<T>(
    path: string,
    init?: RequestInit & { idempotencyKey?: string },
  ): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (init?.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);

    const token = getToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

    if (res.status === 204) return undefined as T;

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const error = json?.error ?? { code: "UNKNOWN_ERROR", message: "Something went wrong." };
      throw new ApiClientError(res.status, error.code, error.message, error.details);
    }

    return json as T;
  }

  function qs(params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const s = search.toString();
    return s ? `?${s}` : "";
  }

  return {
    // ── Public — no auth, used by the guest booking flow ──────────────────
    getRestaurant: () => request<PublicRestaurant>("/restaurant"),

    getCalendar: (month: string, partySize: number) =>
      request<CalendarDay[]>(`/availability/calendar${qs({ month, partySize })}`),

    getSlots: (date: string, partySize: number) =>
      request<SlotAvailability[]>(`/availability/slots${qs({ date, partySize })}`),

    getTables: (date: string, time: string, partySize: number) =>
      request<TableAvailability[]>(`/availability/tables${qs({ date, time, partySize })}`),

    createReservation: (body: CreateReservationRequest, idempotencyKey: string) =>
      request<CreateReservationResponse>("/reservations", {
        method: "POST",
        body: JSON.stringify(body),
        idempotencyKey,
      }),

    getReservation: (id: string) => request<Omit<ReservationDto, "notes">>(`/reservations/${id}`),

    cancelReservation: (id: string) =>
      request<Omit<ReservationDto, "notes">>(`/reservations/${id}/cancel`, { method: "PATCH" }),

    // ── Authenticated — admin/staff ────────────────────────────────────────
    login: (body: LoginRequest) =>
      request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

    listReservations: (params: { date?: string; from?: string; to?: string; status?: string; search?: string }) =>
      request<ReservationDto[]>(`/reservations${qs(params)}`),

    performReservationAction: (id: string, action: "seat" | "complete" | "no_show" | "cancel") =>
      request<ReservationDto>(`/reservations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }),

    listRequests: () => request<RequestQueueItem[]>("/requests"),

    acceptRequest: (id: string, body: AcceptRequestBody) =>
      request<ReservationDto>(`/requests/${id}/accept`, { method: "POST", body: JSON.stringify(body) }),

    acceptRequestOverflow: (id: string) =>
      request<ReservationDto>(`/requests/${id}/accept-overflow`, { method: "POST" }),

    declineRequest: (id: string) => request<ReservationDto>(`/requests/${id}/decline`, { method: "POST" }),

    // ── Tables ──────────────────────────────────────────────────────────────
    listTables: (params: { status?: string; location?: string; includeArchived?: boolean } = {}) =>
      request<(TableDto & { upcomingReservations: number })[]>(`/tables${qs(params)}`),

    getTable: (id: string) => request<TableDto & { upcomingReservations: number }>(`/tables/${id}`),

    createTable: (body: CreateTableRequest) =>
      request<TableDto>("/tables", { method: "POST", body: JSON.stringify(body) }),

    updateTable: (id: string, body: UpdateTableRequest, opts: { force?: boolean } = {}) =>
      request<TableDto>(`/tables/${id}${qs({ force: opts.force })}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    deleteTable: (id: string) => request<void>(`/tables/${id}`, { method: "DELETE" }),

    // ── Settings: restaurant profile ──────────────────────────────────────
    getRestaurantProfile: () => request<RestaurantDto>("/settings/restaurant"),

    updateRestaurantProfile: (body: UpdateRestaurantRequest) =>
      request<RestaurantDto>("/settings/restaurant", { method: "PATCH", body: JSON.stringify(body) }),

    // ── Settings: opening hours ────────────────────────────────────────────
    getHours: () => request<DayHours[]>("/settings/hours"),

    setHours: (body: SetHoursRequest) =>
      request<{
        days: DayHours[];
        affectedReservations: { id: string; guestName: string; dayOfWeek: number; reservationDate: string; reservationTime: string }[];
      }>("/settings/hours", { method: "PUT", body: JSON.stringify(body) }),

    // ── Settings: time slots ───────────────────────────────────────────────
    listSlots: () => request<TimeSlotDto[]>("/settings/slots"),

    createSlot: (body: CreateTimeSlotRequest) =>
      request<TimeSlotDto>("/settings/slots", { method: "POST", body: JSON.stringify(body) }),

    updateSlot: (id: string, body: UpdateTimeSlotRequest) =>
      request<TimeSlotDto>(`/settings/slots/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

    deleteSlot: (id: string) => request<void>(`/settings/slots/${id}`, { method: "DELETE" }),

    // ── Settings: blocked dates ────────────────────────────────────────────
    listBlockedDates: () => request<BlockedDateDto[]>("/settings/blocked-dates"),

    blockDate: (body: CreateBlockedDateRequest) =>
      request<BlockedDateDto & { affectedReservations: number }>("/settings/blocked-dates", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    blockDateRange: (body: CreateBlockedRangeRequest) =>
      request<{ created: BlockedDateDto[]; affectedReservations: number }>("/settings/blocked-dates/range", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    unblockDate: (id: string) => request<void>(`/settings/blocked-dates/${id}`, { method: "DELETE" }),

    // ── Settings: reservation rules ─────────────────────────────────────────
    getRules: () => request<ReservationRulesDto>("/settings/rules"),

    updateRules: (body: UpdateReservationRulesRequest) =>
      request<UpdateReservationRulesResponse>("/settings/rules", { method: "PATCH", body: JSON.stringify(body) }),

    // ── Guests / customers ──────────────────────────────────────────────────
    listGuests: (params: ListGuestsQuery = {}) => request<GuestDto[]>(`/guests${qs(params)}`),

    getGuest: (id: string) => request<GuestDetail>(`/guests/${id}`),

    updateGuest: (id: string, body: UpdateGuestRequest) =>
      request<GuestDto>(`/guests/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

    deleteGuest: (id: string) => request<void>(`/guests/${id}`, { method: "DELETE" }),

    // ── Reports ─────────────────────────────────────────────────────────────
    getReportsSummary: (from: string, to: string) =>
      request<ReportsSummary>(`/reports/summary${qs({ from, to })}`),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
